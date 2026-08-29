import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubjectLiveSession } from './entities/subject-live-session.entity';
import { Course } from '../courses/entities/course.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class LiveSessionsService {
  private readonly logger = new Logger(LiveSessionsService.name);

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

  async findAll(organizationId?: string, batchId?: string, courseId?: string) {
    try {
      const where: any = {};
      if (organizationId) where.organizationId = organizationId;
      if (batchId && batchId !== 'undefined' && batchId !== 'null' && batchId !== 'all') {
        where.batchId = batchId;
      }
      if (courseId && courseId !== 'undefined' && courseId !== 'null' && courseId !== 'all') {
        where.courseId = courseId;
      }

      const sessions = await this.sessionRepo.find({
        where,
        order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
      }).catch(err => {
        this.logger.error('Error fetching sessions:', err);
        return [];
      });

      if (!sessions || sessions.length === 0) return [];

      const courseIds = Array.from(new Set(sessions.map((s) => s.courseId).filter(Boolean)));
      const batchIds = Array.from(new Set(sessions.map((s) => s.batchId).filter(Boolean)));
      const facultyIds = Array.from(new Set(sessions.map((s) => s.facultyId).filter(Boolean)));
      const studentIds = Array.from(new Set(sessions.map((s) => s.studentId).filter(Boolean)));

      const courses = courseIds.length > 0 ? await this.courseRepo.find({ where: { id: In(courseIds) } }).catch(() => []) : [];
      const batches = batchIds.length > 0 ? await this.batchRepo.find({ where: { id: In(batchIds) } }).catch(() => []) : [];
      const users = (facultyIds.length > 0 || studentIds.length > 0) 
        ? await this.userRepo.find({ where: { id: In([...facultyIds, ...studentIds]) } }).catch(() => []) 
        : [];

      const courseMap = new Map(courses.map((c) => [c.id, c.title]));
      const batchMap = new Map(batches.map((b) => [b.id, b.name || 'Batch']));
      const userMap = new Map(users.map((u) => [u.id, u.fullName || u.email]));

      return sessions.map((s) => {
        let attendees: string[] = [];
        try {
          if (Array.isArray(s.attendeeStudentIds)) {
            attendees = s.attendeeStudentIds;
          } else if (typeof s.attendeeStudentIds === 'string' && s.attendeeStudentIds.trim()) {
            attendees = JSON.parse(s.attendeeStudentIds);
          }
        } catch (e) {
          attendees = [];
        }

        return {
          ...s,
          courseTitle: s.courseId ? (courseMap.get(s.courseId) || 'Subject') : 'All Subjects',
          batchName: s.batchId ? (batchMap.get(s.batchId) || 'Batch') : 'All Cohorts',
          facultyName: s.facultyId ? userMap.get(s.facultyId) : null,
          targetStudentName: s.studentId ? userMap.get(s.studentId) : null,
          attendeeCount: attendees.length,
          attendees,
        };
      });
    } catch (err) {
      this.logger.error('Failed in findAll live sessions:', err);
      return [];
    }
  }

  async create(organizationId: string, data: any) {
    if (!data.scheduledDate || !data.scheduledTime) {
      throw new BadRequestException('Scheduled Date and Time are required.');
    }

    const meetingType = data.meetingType || (data.studentId ? 'SINGLE_STUDENT' : 'BATCH');

    const session = this.sessionRepo.create({
      organizationId: organizationId || data.organizationId || 'default',
      batchId: data.batchId || null,
      programId: data.programId || null,
      courseId: data.courseId || null,
      sessionNumber: Number(data.sessionNumber) || 1,
      meetingType,
      facultyId: data.facultyId || null,
      studentId: data.studentId || null,
      hostType: 'ADMIN',
      title: data.title || `Live Call ${data.sessionNumber || 1} of 5`,
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
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');

    if (data.batchId !== undefined) session.batchId = data.batchId;
    if (data.courseId !== undefined) session.courseId = data.courseId;
    if (data.sessionNumber != null) session.sessionNumber = Number(data.sessionNumber);
    if (data.meetingType != null) session.meetingType = data.meetingType;
    if (data.facultyId !== undefined) session.facultyId = data.facultyId;
    if (data.studentId !== undefined) session.studentId = data.studentId;
    if (data.title != null) session.title = data.title;
    if (data.scheduledDate) session.scheduledDate = new Date(data.scheduledDate);
    if (data.scheduledTime) session.scheduledTime = data.scheduledTime;
    if (data.meetingUrl != null) session.meetingUrl = data.meetingUrl;
    if (data.agenda != null) session.agenda = data.agenda;
    if (data.status != null) session.status = data.status;

    return this.sessionRepo.save(session);
  }

  async markAttendance(organizationId: string, id: string, attendeeStudentIds: string[]) {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');

    session.attendeeStudentIds = JSON.stringify(attendeeStudentIds || []);
    session.status = 'COMPLETED';
    return this.sessionRepo.save(session);
  }

  async getBatchRoster(organizationId?: string, batchId?: string, courseId?: string, studentId?: string) {
    try {
      if (studentId) {
        const student = await this.userRepo.findOne({ where: { id: studentId } });
        if (student) {
          return [{
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            mobile: student.mobile,
            photo: (student.customProfile as any)?.documents?.photo?.url || (student.customProfile as any)?.documents?.photo || null,
          }];
        }
      }

      let enrollments: Enrollment[] = [];

      if (batchId && batchId !== 'all' && batchId !== 'undefined') {
        const where: any = { batchId, status: 'ACTIVE' };
        if (organizationId) where.organizationId = organizationId;
        enrollments = await this.enrollmentRepo.find({ where }).catch(() => []);
      }

      if (enrollments.length === 0 && courseId && courseId !== 'all' && courseId !== 'undefined') {
        const where: any = { courseId, status: 'ACTIVE' };
        if (organizationId) where.organizationId = organizationId;
        enrollments = await this.enrollmentRepo.find({ where }).catch(() => []);
      }

      let studentIds = Array.from(new Set(enrollments.map((e) => e.studentId).filter(Boolean)));
      
      if (studentIds.length === 0) {
        const where: any = { userType: 'STUDENT', status: 'ACTIVE', isDeleted: false };
        if (organizationId) where.organizationId = organizationId;
        const allStudents = await this.userRepo.find({ where, take: 100 }).catch(() => []);
        return allStudents.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          mobile: s.mobile,
          photo: (s.customProfile as any)?.documents?.photo?.url || (s.customProfile as any)?.documents?.photo || null,
        }));
      }

      const students = await this.userRepo.find({
        where: { id: In(studentIds) },
      }).catch(() => []);

      return students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        mobile: s.mobile,
        photo: (s.customProfile as any)?.documents?.photo?.url || (s.customProfile as any)?.documents?.photo || null,
      }));
    } catch (err) {
      this.logger.error('Error in getBatchRoster:', err);
      return [];
    }
  }

  async getUpcomingForStudent(organizationId: string, studentId: string) {
    try {
      const enrollments = await this.enrollmentRepo.find({
        where: { studentId, status: 'ACTIVE' },
      }).catch(() => []);

      const batchIds = Array.from(new Set(enrollments.map((e) => e.batchId).filter(Boolean)));

      const queryBuilder = this.sessionRepo.createQueryBuilder('s');
      if (organizationId) {
        queryBuilder.where('s.organizationId = :organizationId', { organizationId });
      } else {
        queryBuilder.where('1 = 1');
      }

      queryBuilder.andWhere('(s.studentId = :studentId OR (s.meetingType = :batchType AND s.batchId IN (:...batchIds)))', {
        studentId,
        batchType: 'BATCH',
        batchIds: batchIds.length > 0 ? batchIds : ['none'],
      })
      .orderBy('s.scheduledDate', 'ASC')
      .addOrderBy('s.scheduledTime', 'ASC')
      .take(20);

      const sessions = await queryBuilder.getMany().catch(() => []);

      const courseIds = Array.from(new Set(sessions.map((s) => s.courseId).filter(Boolean)));
      const facultyIds = Array.from(new Set(sessions.map((s) => s.facultyId).filter(Boolean)));

      const courses = courseIds.length > 0 ? await this.courseRepo.find({ where: { id: In(courseIds) } }).catch(() => []) : [];
      const faculties = facultyIds.length > 0 ? await this.userRepo.find({ where: { id: In(facultyIds) } }).catch(() => []) : [];

      const courseMap = new Map(courses.map((c) => [c.id, c.title]));
      const facultyMap = new Map(faculties.map((f) => [f.id, f.fullName]));

      return sessions.map((s) => {
        let attendees: string[] = [];
        try {
          if (Array.isArray(s.attendeeStudentIds)) attendees = s.attendeeStudentIds;
          else if (typeof s.attendeeStudentIds === 'string' && s.attendeeStudentIds.trim()) attendees = JSON.parse(s.attendeeStudentIds);
        } catch (e) {
          attendees = [];
        }

        const hasAttended = attendees.includes(studentId);
        return {
          ...s,
          courseTitle: s.courseId ? (courseMap.get(s.courseId) || 'Subject') : 'Direct Call',
          facultyName: s.facultyId ? facultyMap.get(s.facultyId) : null,
          hasAttended,
        };
      });
    } catch (err) {
      this.logger.error('Error in getUpcomingForStudent:', err);
      return [];
    }
  }

  async remove(organizationId: string, id: string) {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessionRepo.remove(session);
    return { success: true, message: 'Session deleted successfully' };
  }
}
