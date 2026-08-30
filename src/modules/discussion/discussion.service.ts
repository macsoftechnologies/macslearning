import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Thread } from './entities/thread.entity';
import { Reply } from './entities/reply.entity';
import { Course } from '../courses/entities/course.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(Thread) private threadRepository: Repository<Thread>,
    @InjectRepository(Reply) private replyRepository: Repository<Reply>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(AcademicBatch) private batchRepository: Repository<AcademicBatch>,
    @InjectRepository(Enrollment) private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  // List all conversations for active user (Batch Groups + Admin-Created Subject Groups + 1:1 Direct Messages)
  async getInbox(organizationId: string, userId: string, userType: string) {
    // 1. Direct Messages involving this user
    const directThreads = await this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.threadType = :type', { type: 'DIRECT_MESSAGE' })
      .andWhere('(thread.authorId = :userId OR thread.recipientId = :userId)', { userId })
      .andWhere('thread.isDeleted = false')
      .orderBy('thread.updatedAt', 'DESC')
      .getMany();

    // 2. Batch Groups
    let batchIds: string[] = [];
    let enrolledCourseIds: string[] = [];

    if (userType === 'STUDENT') {
      const enrollments = await this.enrollmentRepository.find({
        where: [
          { organizationId, studentId: userId, status: 'ACTIVE' },
          { organizationId, studentId: userId },
        ],
      });
      batchIds = Array.from(new Set(enrollments.map(e => e.batchId).filter(Boolean)));
      enrolledCourseIds = Array.from(new Set(enrollments.map(e => e.courseId).filter(Boolean)));
    } else if (userType === 'FACULTY') {
      const allBatches = await this.batchRepository.find({ where: { organizationId } });
      batchIds = allBatches.map(b => b.id);
      
      const allCourses = await this.courseRepository.find({ where: { organizationId, isDeleted: false } });
      enrolledCourseIds = allCourses
        .filter(c => Array.isArray(c.instructorIds) && c.instructorIds.includes(userId))
        .map(c => c.id);
    } else {
      // Org Admin / Super Admin
      const allBatches = await this.batchRepository.find({ where: { organizationId } });
      batchIds = allBatches.map(b => b.id);

      const allCourses = await this.courseRepository.find({ where: { organizationId, isDeleted: false } });
      enrolledCourseIds = allCourses.map(c => c.id);
    }

    // Load Batch Threads
    let batchThreads: Thread[] = [];
    if (batchIds.length > 0) {
      batchThreads = await this.threadRepository
        .createQueryBuilder('thread')
        .where('thread.organizationId = :organizationId', { organizationId })
        .andWhere('thread.threadType = :type', { type: 'BATCH_GROUP' })
        .andWhere('thread.batchId IN (:...batchIds)', { batchIds })
        .andWhere('thread.isDeleted = false')
        .orderBy('thread.updatedAt', 'DESC')
        .getMany();
    }

    // Load Admin-Created Course / Subject Groups
    let courseThreads: Thread[] = [];
    if (userType === 'ORG_USER' || userType === 'SUPER_ADMIN') {
      courseThreads = await this.threadRepository.find({
        where: { organizationId, threadType: 'COURSE_GROUP', isDeleted: false },
        order: { updatedAt: 'DESC' },
      });
    } else {
      const qb = this.threadRepository
        .createQueryBuilder('thread')
        .where('thread.organizationId = :organizationId', { organizationId })
        .andWhere('thread.threadType = :type', { type: 'COURSE_GROUP' })
        .andWhere('thread.isDeleted = false');

      if (userType === 'STUDENT') {
        if (batchIds.length > 0 && enrolledCourseIds.length > 0) {
          qb.andWhere('(thread.courseId IN (:...enrolledCourseIds) OR thread.batchId IN (:...batchIds))', { enrolledCourseIds, batchIds });
        } else if (batchIds.length > 0) {
          qb.andWhere('thread.batchId IN (:...batchIds)', { batchIds });
        } else if (enrolledCourseIds.length > 0) {
          qb.andWhere('thread.courseId IN (:...enrolledCourseIds)', { enrolledCourseIds });
        }
      } else if (userType === 'FACULTY') {
        if (enrolledCourseIds.length > 0) {
          qb.andWhere('thread.courseId IN (:...enrolledCourseIds)', { enrolledCourseIds });
        }
      }

      courseThreads = await qb.orderBy('thread.updatedAt', 'DESC').getMany();
    }

    // Map Partner User metadata
    const partnerUserIds = new Set<string>();
    for (const t of directThreads) {
      const partnerId = t.authorId === userId ? t.recipientId : t.authorId;
      if (partnerId) partnerUserIds.add(partnerId);
    }

    const partnerUsers = partnerUserIds.size > 0 
      ? await this.userRepository.find({ where: { id: In(Array.from(partnerUserIds)), organizationId } }) 
      : [];
    const userMap = new Map(partnerUsers.map(u => [u.id, {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userType: u.userType,
      photo: (u.customProfile as any)?.documents?.photo?.url || (u.customProfile as any)?.documents?.photo || null,
    }]));

    const batches = batchIds.length > 0 
      ? await this.batchRepository.find({ where: { id: In(batchIds) } }) 
      : [];
    const batchMap = new Map(batches.map(b => [b.id, b.name || 'Cohort Group']));

    const allOrgCourses = await this.courseRepository.find({ where: { organizationId, isDeleted: false } });
    const courseMap = new Map(allOrgCourses.map(c => [c.id, c.title || 'Course Subject']));

    const formattedDirect = directThreads.map(t => {
      const partnerId = t.authorId === userId ? t.recipientId : t.authorId;
      const partner = userMap.get(partnerId) || { id: partnerId, fullName: 'User', userType: 'STUDENT' };
      return {
        id: t.id,
        threadType: 'DIRECT_MESSAGE',
        title: partner.fullName,
        partner,
        lastMessage: t.lastMessage || t.content || '',
        lastMessageAt: t.lastMessageAt || t.updatedAt,
        replyCount: t.replyCount || 0,
      };
    });

    const formattedBatch = batchThreads.map(t => ({
      id: t.id,
      threadType: 'BATCH_GROUP',
      batchId: t.batchId,
      title: t.title || batchMap.get(t.batchId) || 'Batch Group',
      lastMessage: t.lastMessage || t.content || '',
      lastMessageAt: t.lastMessageAt || t.updatedAt,
      replyCount: t.replyCount || 0,
    }));

    const formattedCourse = courseThreads.map(t => {
      const cTitle = courseMap.get(t.courseId) || 'Subject';
      const bName = t.batchId ? batchMap.get(t.batchId) : null;
      const displayTitle = t.title || (bName ? `${bName} - ${cTitle}` : `${cTitle} Discussion`);
      return {
        id: t.id,
        threadType: 'COURSE_GROUP',
        courseId: t.courseId,
        batchId: t.batchId,
        title: displayTitle,
        lastMessage: t.lastMessage || t.content || '',
        lastMessageAt: t.lastMessageAt || t.updatedAt,
        replyCount: t.replyCount || 0,
      };
    });

    return {
      directChats: formattedDirect,
      batchGroups: formattedBatch,
      courseGroups: formattedCourse,
    };
  }

  // Helper method to resolve enrolled students for course & batch
  private async resolveEnrolledStudents(organizationId: string, courseId?: string, batchId?: string): Promise<User[]> {
    let studentIds = new Set<string>();

    if (courseId && batchId) {
      // 1. Try exact course + batch match
      const exactEnrollments = await this.enrollmentRepository.find({
        where: [
          { organizationId, courseId, batchId, status: 'ACTIVE' },
          { organizationId, courseId, batchId },
        ],
      });
      exactEnrollments.forEach(e => studentIds.add(e.studentId));

      // 2. If empty, check batch-level enrollments (all students in this cohort batch)
      if (studentIds.size === 0) {
        const batchEnrollments = await this.enrollmentRepository.find({
          where: [
            { organizationId, batchId, status: 'ACTIVE' },
            { organizationId, batchId },
          ],
        });
        batchEnrollments.forEach(e => studentIds.add(e.studentId));
      }

      // 3. Check course-level enrollments
      if (studentIds.size === 0) {
        const courseEnrollments = await this.enrollmentRepository.find({
          where: [
            { organizationId, courseId, status: 'ACTIVE' },
            { organizationId, courseId },
          ],
        });
        courseEnrollments.forEach(e => studentIds.add(e.studentId));
      }
    } else if (courseId) {
      const courseEnrollments = await this.enrollmentRepository.find({
        where: [
          { organizationId, courseId, status: 'ACTIVE' },
          { organizationId, courseId },
        ],
      });
      courseEnrollments.forEach(e => studentIds.add(e.studentId));
    } else if (batchId) {
      const batchEnrollments = await this.enrollmentRepository.find({
        where: [
          { organizationId, batchId, status: 'ACTIVE' },
          { organizationId, batchId },
        ],
      });
      batchEnrollments.forEach(e => studentIds.add(e.studentId));
    }

    if (studentIds.size === 0) return [];

    return this.userRepository.find({
      where: {
        id: In(Array.from(studentIds)),
        organizationId,
        isDeleted: false,
      },
    });
  }

  // Get available contacts to start 1:1 chat with (Admins, Faculty, Classmates)
  async getContacts(organizationId: string, userId: string, userType: string) {
    const staff = await this.userRepository.find({
      where: [
        { organizationId, userType: 'ORG_USER', status: 'ACTIVE', isDeleted: false },
        { organizationId, userType: 'FACULTY', status: 'ACTIVE', isDeleted: false },
      ],
    });

    let classmates: any[] = [];
    if (userType === 'STUDENT') {
      const myEnrollments = await this.enrollmentRepository.find({
        where: [
          { organizationId, studentId: userId, status: 'ACTIVE' },
          { organizationId, studentId: userId },
        ],
      });
      const myBatchIds = Array.from(new Set(myEnrollments.map(e => e.batchId).filter(Boolean)));
      if (myBatchIds.length > 0) {
        const peerEnrollments = await this.enrollmentRepository.find({
          where: [
            { organizationId, batchId: In(myBatchIds), status: 'ACTIVE' },
            { organizationId, batchId: In(myBatchIds) },
          ],
        });
        const peerStudentIds = Array.from(new Set(peerEnrollments.map(e => e.studentId).filter(id => id !== userId)));
        if (peerStudentIds.length > 0) {
          classmates = await this.userRepository.find({
            where: { id: In(peerStudentIds), organizationId, isDeleted: false },
          });
        }
      }
    } else {
      classmates = await this.userRepository.find({
        where: { organizationId, userType: 'STUDENT', status: 'ACTIVE', isDeleted: false },
        take: 100,
      });
    }

    const formatUser = (u: any) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userType: u.userType,
      photo: (u.customProfile as any)?.documents?.photo?.url || (u.customProfile as any)?.documents?.photo || null,
    });

    return {
      adminsAndFaculty: staff.filter(s => s.id !== userId).map(formatUser),
      classmates: classmates.map(formatUser),
    };
  }

  // Start or get existing 1:1 Direct Thread
  async startOrGetDirectThread(organizationId: string, authorId: string, recipientId: string, initialMessage?: string) {
    if (authorId === recipientId) {
      throw new BadRequestException('Cannot start direct conversation with yourself.');
    }

    let thread = await this.threadRepository.findOne({
      where: [
        { organizationId, threadType: 'DIRECT_MESSAGE', authorId, recipientId, isDeleted: false },
        { organizationId, threadType: 'DIRECT_MESSAGE', authorId: recipientId, recipientId: authorId, isDeleted: false },
      ],
    });

    if (!thread) {
      thread = this.threadRepository.create({
        organizationId,
        threadType: 'DIRECT_MESSAGE',
        authorId,
        recipientId,
        title: 'Direct Conversation',
        content: initialMessage || 'Conversation started',
        lastMessage: initialMessage || 'Conversation started',
        lastMessageAt: new Date(),
        replyCount: 0,
      });
      await this.threadRepository.save(thread);
    }

    if (initialMessage && initialMessage.trim()) {
      await this.addMessage(organizationId, thread.id, authorId, initialMessage);
    }

    return thread;
  }

  // Ensure or get Batch Group Thread
  async getOrCreateBatchThread(organizationId: string, batchId: string, batchTitle?: string) {
    let thread = await this.threadRepository.findOne({
      where: { organizationId, threadType: 'BATCH_GROUP', batchId, isDeleted: false },
    });

    if (!thread) {
      thread = this.threadRepository.create({
        organizationId,
        threadType: 'BATCH_GROUP',
        batchId,
        authorId: 'SYSTEM',
        title: batchTitle || 'Cohort Batch Group',
        content: 'Welcome to your Cohort Group discussion!',
        lastMessage: 'Welcome to your Cohort Group discussion!',
        lastMessageAt: new Date(),
        replyCount: 0,
      });
      await this.threadRepository.save(thread);
    }

    return thread;
  }

  // Ensure or get Course Group Thread (Per Batch & Course)
  async getOrCreateCourseThread(organizationId: string, courseId: string, batchId?: string, title?: string) {
    const where: any = { organizationId, threadType: 'COURSE_GROUP', courseId, isDeleted: false };
    if (batchId) where.batchId = batchId;

    let thread = await this.threadRepository.findOne({ where });

    if (!thread) {
      const course = await this.courseRepository.findOne({ where: { id: courseId, organizationId } });
      const batch = batchId ? await this.batchRepository.findOne({ where: { id: batchId, organizationId } }) : null;
      
      const defaultTitle = title || (batch ? `${batch.name} - ${course?.title || 'Subject'}` : `${course?.title || 'Subject'} Discussion`);

      thread = this.threadRepository.create({
        organizationId,
        threadType: 'COURSE_GROUP',
        courseId,
        batchId: batchId || undefined,
        authorId: 'SYSTEM',
        title: defaultTitle,
        content: `Welcome to ${defaultTitle}!`,
        lastMessage: `Welcome to ${defaultTitle}!`,
        lastMessageAt: new Date(),
        replyCount: 0,
      });
      await this.threadRepository.save(thread);
    }

    return thread;
  }

  // Get messages for any thread (1:1, Batch Group, or Course Group)
  async getThreadMessages(organizationId: string, threadId: string) {
    const thread = await this.threadRepository.findOne({ where: { id: threadId, organizationId, isDeleted: false } });
    if (!thread) throw new NotFoundException('Thread not found');

    const replies = await this.replyRepository.find({
      where: { threadId, organizationId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });

    const authorIds = Array.from(new Set(replies.map(r => r.authorId).filter(id => id !== 'SYSTEM')));
    if (thread.authorId && thread.authorId !== 'SYSTEM') authorIds.push(thread.authorId);
    if (thread.recipientId) authorIds.push(thread.recipientId);

    const authors = authorIds.length > 0 
      ? await this.userRepository.find({ where: { id: In(authorIds), organizationId } }) 
      : [];

    const authorMap = new Map(authors.map(u => [u.id, {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userType: u.userType,
      photo: (u.customProfile as any)?.documents?.photo?.url || (u.customProfile as any)?.documents?.photo || null,
    }]));

    return {
      thread: {
        ...thread,
        partner: thread.recipientId ? authorMap.get(thread.recipientId) : null,
      },
      messages: replies.map(r => ({
        id: r.id,
        content: r.content,
        authorId: r.authorId,
        author: authorMap.get(r.authorId) || { id: r.authorId, fullName: 'User', userType: 'STUDENT' },
        createdAt: r.createdAt,
      })),
    };
  }

  // Send a message into a thread
  async addMessage(organizationId: string, threadId: string, authorId: string, content: string) {
    if (!content || !content.trim()) throw new BadRequestException('Message content cannot be empty');

    const thread = await this.threadRepository.findOne({
      where: { id: threadId, organizationId, isDeleted: false },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const reply = this.replyRepository.create({
      organizationId,
      threadId,
      authorId,
      content: content.trim(),
    });
    const savedReply = await this.replyRepository.save(reply);

    thread.replyCount = (thread.replyCount || 0) + 1;
    thread.lastMessage = content.trim();
    thread.lastMessageAt = new Date();
    await this.threadRepository.save(thread);

    // Notify recipient if 1:1 message
    try {
      if (thread.threadType === 'DIRECT_MESSAGE') {
        const notifyTargetId = thread.authorId === authorId ? thread.recipientId : thread.authorId;
        if (notifyTargetId) {
          const sender = await this.userRepository.findOne({ where: { id: authorId, organizationId } });
          await this.notificationsService.createNotification(
            organizationId,
            notifyTargetId,
            `New Message from ${sender?.fullName || 'User'}`,
            content.substring(0, 100),
            'CHAT',
            '/chat',
          );
        }
      }
    } catch (e) {}

    const sender = await this.userRepository.findOne({ where: { id: authorId, organizationId } });
    return {
      id: savedReply.id,
      content: savedReply.content,
      authorId: savedReply.authorId,
      author: {
        id: sender?.id || authorId,
        fullName: sender?.fullName || 'User',
        email: sender?.email,
        userType: sender?.userType || 'STUDENT',
        photo: (sender?.customProfile as any)?.documents?.photo?.url || null,
      },
      createdAt: savedReply.createdAt,
    };
  }

  // Get all members of a group thread strictly scoped by batch and course
  async getThreadMembers(organizationId: string, threadId: string) {
    const thread = await this.threadRepository.findOne({ where: { id: threadId, organizationId, isDeleted: false } });
    if (!thread) throw new NotFoundException('Thread not found');

    let staff: any[] = [];

    // 1. Staff Members: Org Admins + Only Assigned Faculty for this Course
    const admins = await this.userRepository.find({
      where: [
        { organizationId, userType: 'ORG_USER', status: 'ACTIVE', isDeleted: false },
        { organizationId, userType: 'SUPER_ADMIN', status: 'ACTIVE', isDeleted: false },
      ],
    });

    let assignedFaculty: any[] = [];
    if (thread.courseId) {
      const course = await this.courseRepository.findOne({ where: { id: thread.courseId, organizationId } });
      if (course && Array.isArray(course.instructorIds) && course.instructorIds.length > 0) {
        assignedFaculty = await this.userRepository.find({
          where: { id: In(course.instructorIds), organizationId, status: 'ACTIVE', isDeleted: false },
        });
      }
    } else {
      assignedFaculty = await this.userRepository.find({
        where: { organizationId, userType: 'FACULTY', status: 'ACTIVE', isDeleted: false },
      });
    }

    staff = [...admins, ...assignedFaculty];

    // 2. Enrolled Students: resolve through helper
    const students = await this.resolveEnrolledStudents(organizationId, thread.courseId, thread.batchId);

    const formatUser = (u: any) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userType: u.userType,
      photo: (u.customProfile as any)?.documents?.photo?.url || (u.customProfile as any)?.documents?.photo || null,
    });

    return {
      batchId: thread.batchId,
      courseId: thread.courseId,
      threadTitle: thread.title,
      totalCount: staff.length + students.length,
      staff: staff.map(formatUser),
      students: students.map(formatUser),
    };
  }

  // Preview members for a batch and course before creating group
  async previewMembers(organizationId: string, courseId?: string, batchId?: string) {
    let staff: any[] = [];

    const admins = await this.userRepository.find({
      where: [
        { organizationId, userType: 'ORG_USER', status: 'ACTIVE', isDeleted: false },
        { organizationId, userType: 'SUPER_ADMIN', status: 'ACTIVE', isDeleted: false },
      ],
    });

    let assignedFaculty: any[] = [];
    if (courseId) {
      const course = await this.courseRepository.findOne({ where: { id: courseId, organizationId } });
      if (course && Array.isArray(course.instructorIds) && course.instructorIds.length > 0) {
        assignedFaculty = await this.userRepository.find({
          where: { id: In(course.instructorIds), organizationId, status: 'ACTIVE', isDeleted: false },
        });
      }
    } else {
      assignedFaculty = await this.userRepository.find({
        where: { organizationId, userType: 'FACULTY', status: 'ACTIVE', isDeleted: false },
      });
    }

    staff = [...admins, ...assignedFaculty];

    // Enrolled Students
    const students = await this.resolveEnrolledStudents(organizationId, courseId, batchId);

    const formatUser = (u: any) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userType: u.userType,
      photo: (u.customProfile as any)?.documents?.photo?.url || (u.customProfile as any)?.documents?.photo || null,
    });

    return {
      batchId,
      courseId,
      totalCount: staff.length + students.length,
      staff: staff.map(formatUser),
      students: students.map(formatUser),
    };
  }

  // Legacy Course Forum methods
  async createThread(organizationId: string, courseId: string, authorId: string, threadData: any) {
    const thread = this.threadRepository.create({
      ...threadData,
      organizationId,
      courseId,
      authorId,
      threadType: 'COURSE_FORUM',
    });
    return this.threadRepository.save(thread);
  }

  async getThreads(organizationId: string, courseId: string, lessonId?: string) {
    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoin(User, 'author', 'author.id = thread.authorId')
      .where('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.courseId = :courseId', { courseId })
      .andWhere('thread.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('thread.createdAt', 'DESC');

    if (lessonId) queryBuilder.andWhere('thread.lessonId = :lessonId', { lessonId });

    const threads = await queryBuilder.getMany();
    return threads;
  }

  async findThreadById(organizationId: string, courseId: string | undefined, threadId: string) {
    return this.threadRepository.findOne({ where: { id: threadId, organizationId, isDeleted: false } });
  }

  async getThreadById(organizationId: string, courseId: string | undefined, threadId: string) {
    return this.threadRepository.findOne({ where: { id: threadId, organizationId, isDeleted: false } });
  }

  async addReply(organizationId: string, threadId: string, authorId: string, content: string) {
    return this.addMessage(organizationId, threadId, authorId, content);
  }

  async getReplies(organizationId: string, threadId: string) {
    const replies = await this.replyRepository.find({
      where: { threadId, organizationId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
    const authorIds = Array.from(new Set(replies.map(r => r.authorId)));
    const authors = authorIds.length > 0 ? await this.userRepository.find({ where: { id: In(authorIds), organizationId } }) : [];
    const authorMap = new Map(authors.map(u => [u.id, u]));

    return replies.map(r => ({
      ...r,
      authorId: authorMap.get(r.authorId) || { id: r.authorId, fullName: 'User' },
    }));
  }

  async deleteThread(organizationId: string, threadId: string) {
    const thread = await this.threadRepository.findOne({ where: { id: threadId, organizationId } });
    if (thread) {
      thread.isDeleted = true;
      await this.threadRepository.save(thread);
    }
    return { message: 'Thread deleted' };
  }

  async deleteReply(organizationId: string, replyId: string) {
    const reply = await this.replyRepository.findOne({ where: { id: replyId, organizationId } });
    if (reply) {
      reply.isDeleted = true;
      await this.replyRepository.save(reply);
    }
    return { message: 'Reply deleted' };
  }

  async markAccepted(organizationId: string, replyId: string) {
    const reply = await this.replyRepository.findOne({ where: { id: replyId, organizationId } });
    if (reply) {
      reply.isAcceptedAnswer = true;
      await this.replyRepository.save(reply);
    }
    return reply;
  }
}
