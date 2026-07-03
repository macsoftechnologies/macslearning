import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name) private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name) private submissionModel: Model<SubmissionDocument>,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  async createAssignment(organizationId: string, courseId: string, createdBy: string, assignmentData: any) {
    const dueDate = new Date(assignmentData.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueDate must be a valid date');
    }
    if (dueDate < new Date()) {
      throw new BadRequestException('dueDate must be in the future');
    }
    if (typeof assignmentData.totalMarks !== 'number' || assignmentData.totalMarks <= 0) {
      throw new BadRequestException('totalMarks must be greater than 0');
    }

    const assignment = new this.assignmentModel({
      ...assignmentData,
      dueDate,
      organizationId,
      courseId,
      createdBy,
    });
    return assignment.save();
  }

  async getAssignments(organizationId: string, courseId: string) {
    return this.assignmentModel.find({ organizationId, courseId, isDeleted: false }).sort({ createdAt: -1 });
  }

  async submitAssignment(organizationId: string, assignmentId: string, studentId: string, fileUrl: string) {
    if (!fileUrl) {
      throw new BadRequestException('Submission file is required');
    }

    const assignment = await this.assignmentModel.findOne({ _id: assignmentId, organizationId, isDeleted: false });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const now = new Date();
    const isLate = assignment.dueDate ? now > new Date(assignment.dueDate) : false;

    const submission = await this.submissionModel.findOneAndUpdate(
      { organizationId, assignmentId, studentId },
      { $set: { fileUrl, status: 'PENDING', isLate } },
      { new: true, upsert: true }
    );
    return submission;
  }

  async gradeSubmission(organizationId: string, submissionId: string, gradedBy: string, graderType: string, gradeData: any) {
    const { marksObtained, feedback, status } = gradeData;
    const submission = await this.submissionModel.findOne({ _id: submissionId, organizationId });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const assignment = await this.assignmentModel.findOne({ _id: submission.assignmentId, organizationId, isDeleted: false });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (typeof marksObtained !== 'number' || marksObtained < 0 || marksObtained > assignment.totalMarks) {
      throw new BadRequestException('marksObtained must be between 0 and assignment total marks');
    }

    submission.marksObtained = marksObtained;
    submission.feedback = feedback;
    if (status && !['GRADED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Invalid submission grading status');
    }
    submission.status = status || 'GRADED';
    submission.gradedBy = new Types.ObjectId(gradedBy);
    submission.gradedAt = new Date();
    const savedSubmission = await submission.save();

    // If a faculty graded the submission, notify the student and record an audit entry
    try {
      if (graderType === 'FACULTY') {
        await this.notificationsService.createNotification(
          organizationId,
          submission.studentId.toString(),
          'Assignment graded',
          `Your submission for assignment ${submission.assignmentId} was graded. Marks: ${marksObtained}`,
          'GRADING',
          `/assignments/${submission.assignmentId}`
        );

        await this.auditService.createLog({
          organizationId,
          actorId: gradedBy,
          action: 'grade_submission',
          targetId: submissionId,
          metadata: { marksObtained, feedback }
        });
      }
    } catch (e) {
      // don't fail grading due to notification/audit errors
    }

    return submission;
  }

  async getAssignmentSubmissions(organizationId: string, assignmentId: string) {
    return this.submissionModel
      .find({ organizationId, assignmentId })
      .populate('studentId', 'fullName email')
      .sort({ submittedAt: -1 });
  }

  async findAssignmentById(organizationId: string, assignmentId: string) {
    const assignment = await this.assignmentModel.findOne({ _id: assignmentId, organizationId, isDeleted: false });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }
}
