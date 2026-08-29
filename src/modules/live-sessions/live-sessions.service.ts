import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubjectLiveSession } from './entities/subject-live-session.entity';
import { Course } from '../courses/entities/course.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class LiveSessionsService {
  constructor(
    @InjectRepository(SubjectLiveSession)
    private sessionRepo: Repository<SubjectLiveSession>,
    @InjectRepository(Course)
    private courseRepo: Repository<Course>,
    @InjectRepository(AcademicBatch)
    private batchRepo: Repository<AcademicBatch>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll(organizationId: string, batchId?: string, courseId?: string) {
    const where: any = { organizationId };
    if (batchId) where.batchId = batchId;
    if (courseId) where.courseId = courseId;

    const sessions = await this.sessionRepo.find({
      where,
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });

    const courseIds = Array.from(new Set(sessions.map((s) => s.courseId)));
    const batchIds = Array.from(new Set(sessions.map((s) => s.batchId)));

    const courses = courseIds.length > 0
      ? await this.courseRepo.find({ where: { id: In(courseIds) } })
      : [];
    const batches = batchIds.length > 0
      ? await this.batchRepo.find({ where: { id: In(batchIds) } })
      : [];

    const courseMap = new Map(courses.map((c) => [c.id, c.title]));
    const batchMap = new Map(batches.map((b) => [b.id, b.name || 'Batch']));

    return sessions.map((s) => {
      const attendees = s.attendeeStudentIds ? JSON.parse(s.attendeeStudentIds) : [];
      return {
        ...s,
        courseTitle: courseMap.get(s.courseId) || 'Subject',
        batchName: batchMap.get(s.batchId) || 'Batch',
        attendeeCount: attendees.length,
        attendees,
      };
    });
  }

  async create(organizationId: string, data: any) {
    if (!data.batchId || !data.courseId || !data.scheduledDate || !data.scheduledTime) {
      throw new BadRequestException('Batch, Subject, Date, and Time are required.');
    }

    const session = this.sessionRepo.create({
      organizationId,
      batchId: data.batchId,
      programId: data.programId || null,
      courseId: data.courseId,
      sessionNumber: Number(data.sessionNumber) || 1,
      title: data.title || `Call ${data.sessionNumber || 1} of 5`,
      scheduledDate: new Date(data.scheduledDate),
      scheduledTime: data.scheduledTime,
      meetingUrl: data.meetingUrl || '',
      agenda: data.agenda || '',
      status: 'SCHEDULED',
      attendeeStudentIds: JSON.stringify([]),
    });

    return this.sessionRepo.save(session);
  }

  async update(organizationId: string, id: string, data: any) {
    const session = await this.sessionRepo.findOne({ where: { id, organizationId } });
    if (!session) throw new NotFoundException('Live session not found');

    if (data.sessionNumber != null) session.sessionNumber = Number(data.sessionNumber);
    if (data.title != null) session.title = data.title;
    if (data.scheduledDate) session.scheduledDate = new Date(data.scheduledDate);
    if (data.scheduledTime) session.scheduledTime = data.scheduledTime;
    if (data.meetingUrl != null) session.meetingUrl = data.meetingUrl;
    if (data.agenda != null) session.agenda = data.agenda;
    if (data.status != null) session.status = data.status;

    return this.sessionRepo.save(session);
  }

  async markAttendance(organizationId: string, id: string, attendeeStudentIds: string[]) {
    const session = await this.sessionRepo.findOne({ where: { id, organizationId } });
    if (!session) throw new NotFoundException('Live session not found');

    session.attendeeStudentIds = JSON.stringify(attendeeStudentIds || []);
    session.status = 'COMPLETED';
    return this.sessionRepo.save(session);
  }

  async getBatchRoster(organizationId: string, batchId: string, courseId?: string) {
    let enrollments: Enrollment[] = [];

    if (batchId && batchId !== 'all') {
      enrollments = await this.enrollmentRepo.find({
        where: { organizationId, batchId, status: 'ACTIVE' },
      });
    }

    if (enrollments.length === 0 && courseId) {
      enrollments = await this.enrollmentRepo.find({
        where: { organizationId, courseId, status: 'ACTIVE' },
      });
    }

    let studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
    
    // If still empty, fetch all active students of the organization as fallback
    if (studentIds.length === 0) {
      const allStudents = await this.userRepo.find({
        where: { organizationId, userType: 'STUDENT', status: 'ACTIVE', isDeleted: false },
        take: 100,
      });
      return allStudents.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        mobile: s.mobile,
        photo: (s.customProfile as any)?.documents?.photo?.url || (s.customProfile as any)?.documents?.photo || null,
      }));
    }

    const students = await this.userRepo.find({
      where: { id: In(studentIds), organizationId },
    });

    return students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      mobile: s.mobile,
      photo: (s.customProfile as any)?.documents?.photo?.url || (s.customProfile as any)?.documents?.photo || null,
    }));
  }

  async getUpcomingForStudent(organizationId: string, studentId: string) {
    const enrollments = await this.enrollmentRepo.find({
      where: { organizationId, studentId, status: 'ACTIVE' },
    });

    const batchIds = Array.from(new Set(enrollments.map((e) => e.batchId).filter(Boolean)));
    if (batchIds.length === 0) return [];

    const sessions = await this.sessionRepo.find({
      where: {
        organizationId,
        batchId: In(batchIds),
        status: 'SCHEDULED',
      },
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
      take: 5,
    });

    const courseIds = Array.from(new Set(sessions.map((s) => s.courseId)));
    const courses = courseIds.length > 0
      ? await this.courseRepo.find({ where: { id: In(courseIds) } })
      : [];
    const courseMap = new Map(courses.map((c) => [c.id, c.title]));

    return sessions.map((s) => {
      const attendees = s.attendeeStudentIds ? JSON.parse(s.attendeeStudentIds) : [];
      const hasAttended = attendees.includes(studentId);
      return {
        ...s,
        courseTitle: courseMap.get(s.courseId) || 'Subject',
        hasAttended,
      };
    });
  }

  async remove(organizationId: string, id: string) {
    const session = await this.sessionRepo.findOne({ where: { id, organizationId } });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessionRepo.remove(session);
    return { success: true, message: 'Session deleted successfully' };
  }
}
