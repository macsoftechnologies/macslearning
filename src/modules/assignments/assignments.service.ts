import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { Submission } from './entities/submission.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { CoursesService } from '../courses/courses.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
    private coursesService: CoursesService,
  ) {}

  async createAssignment(
    organizationId: string,
    courseId: string,
    createdBy: string,
    assignmentData: any,
  ) {
    const dueDate = new Date(assignmentData.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueDate must be a valid date');
    }
    if (dueDate < new Date()) {
      throw new BadRequestException('dueDate must be in the future');
    }
    if (
      typeof assignmentData.totalMarks !== 'number' ||
      assignmentData.totalMarks <= 0
    ) {
      throw new BadRequestException('totalMarks must be greater than 0');
    }

    const assignment = this.assignmentRepository.create({
      ...assignmentData,
      dueDate,
      organizationId,
      courseId,
      createdBy,
    });
    return this.assignmentRepository.save(assignment);
  }

  async getAssignments(organizationId: string, courseId: string) {
    return this.assignmentRepository.find({
      where: { organizationId, courseId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async submitAssignment(
    organizationId: string,
    assignmentId: string,
    studentId: string,
    fileUrl: string,
  ) {
    if (!fileUrl) {
      throw new BadRequestException('Submission file is required');
    }

    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, organizationId, isDeleted: false },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const now = new Date();
    const isLate = assignment.dueDate
      ? now > new Date(assignment.dueDate)
      : false;

    let submission = await this.submissionRepository.findOne({
      where: { organizationId, assignmentId, studentId },
    });

    if (submission) {
      submission.fileUrl = fileUrl;
      submission.status = 'PENDING';
      submission.isLate = isLate;
    } else {
      submission = this.submissionRepository.create({
        organizationId,
        assignmentId,
        studentId,
        fileUrl,
        status: 'PENDING',
        isLate,
      });
    }

    const savedSubmission = await this.submissionRepository.save(submission);

    // Notify faculty
    try {
      const course = await this.coursesService.getCourseById(assignment.courseId, organizationId);
      if (course && course.instructorIds && course.instructorIds.length > 0) {
        await this.notificationsService.createNotificationsBulk(
          organizationId,
          course.instructorIds,
          'Assignment Submitted',
          `A student has submitted the assignment "${assignment.title}" for course "${course.title}".`,
          'SYSTEM',
          `/faculty/courses/${assignment.courseId}/assignments/${assignment.id}/submissions`,
        );
      }
    } catch (e) {}

    return savedSubmission;
  }

  async gradeSubmission(
    organizationId: string,
    submissionId: string,
    gradedBy: string,
    graderType: string,
    gradeData: any,
  ) {
    const { marksObtained, feedback, status } = gradeData;
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId, organizationId },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const assignment = await this.assignmentRepository.findOne({
      where: { id: submission.assignmentId, organizationId, isDeleted: false },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (
      typeof marksObtained !== 'number' ||
      marksObtained < 0 ||
      marksObtained > (assignment.totalMarks || 100)
    ) {
      throw new BadRequestException(
        'marksObtained must be between 0 and assignment total marks',
      );
    }

    submission.marksObtained = marksObtained;
    submission.feedback = feedback;
    if (status && !['GRADED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Invalid submission grading status');
    }
    submission.status = status || 'GRADED';
    submission.gradedBy = gradedBy;
    submission.gradedAt = new Date();
    const savedSubmission = await this.submissionRepository.save(submission);

    // If a faculty graded the submission, notify the student and record an audit entry
    try {
      if (graderType === 'FACULTY') {
        await this.notificationsService.createNotification(
          organizationId,
          submission.studentId,
          'Assignment graded',
          `Your submission for assignment ${submission.assignmentId} was graded. Marks: ${marksObtained}`,
          'GRADING',
          `/assignments/${submission.assignmentId}`,
        );

        await this.auditService.createLog({
          organizationId,
          actorId: gradedBy,
          action: 'grade_submission',
          targetId: submissionId,
          metadata: { marksObtained, feedback },
        });
      }
    } catch (e) {
      // don't fail grading due to notification/audit errors
    }

    return savedSubmission;
  }

  async getAssignmentSubmissions(organizationId: string, assignmentId: string) {
    const submissions = await this.submissionRepository
      .createQueryBuilder('sub')
      .leftJoin(User, 'student', 'student.id = sub.studentId')
      .where('sub.organizationId = :organizationId', { organizationId })
      .andWhere('sub.assignmentId = :assignmentId', { assignmentId })
      .select([
        'sub.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
      ])
      .orderBy('sub.createdAt', 'DESC')
      .getRawMany();

    return submissions.map((s) => ({
      ...s,
      studentId: {
        _id: s.student_id,
        id: s.student_id,
        fullName: s.student_fullName,
        email: s.student_email,
      },
    }));
  }

  async findAssignmentById(organizationId: string, assignmentId: string) {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, organizationId, isDeleted: false },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }
}
