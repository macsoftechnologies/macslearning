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

  // List all conversations for the active user (Batch Groups + 1:1 Direct Messages)
  async getInbox(organizationId: string, userId: string, userType: string) {
    // 1. Get Direct Messages involving this user
    const directThreads = await this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.threadType = :type', { type: 'DIRECT_MESSAGE' })
      .andWhere('(thread.authorId = :userId OR thread.recipientId = :userId)', { userId })
      .andWhere('thread.isDeleted = false')
      .orderBy('thread.updatedAt', 'DESC')
      .getMany();

    // 2. Get Batch Groups user belongs to
    let batchIds: string[] = [];
    if (userType === 'STUDENT') {
      const enrollments = await this.enrollmentRepository.find({
        where: { organizationId, studentId: userId, status: 'ACTIVE' },
      });
      batchIds = Array.from(new Set(enrollments.map(e => e.batchId).filter(Boolean)));
    } else {
      // Admin / Faculty see all batches of the organization
      const allBatches = await this.batchRepository.find({ where: { organizationId } });
      batchIds = allBatches.map(b => b.id);
    }

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

    // Collect all partner user IDs
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

    return {
      directChats: formattedDirect,
      batchGroups: formattedBatch,
    };
  }

  // Get available contacts to start 1:1 chat with (Admins, Faculty, Classmates)
  async getContacts(organizationId: string, userId: string, userType: string) {
    // 1. Always get Org Admins & Faculty
    const staff = await this.userRepository.find({
      where: [
        { organizationId, userType: 'ORG_USER', status: 'ACTIVE', isDeleted: false },
        { organizationId, userType: 'FACULTY', status: 'ACTIVE', isDeleted: false },
      ],
    });

    // 2. Get Classmates (Students in same batch)
    let classmates: any[] = [];
    if (userType === 'STUDENT') {
      const myEnrollments = await this.enrollmentRepository.find({
        where: { organizationId, studentId: userId, status: 'ACTIVE' },
      });
      const myBatchIds = Array.from(new Set(myEnrollments.map(e => e.batchId).filter(Boolean)));
      if (myBatchIds.length > 0) {
        const peerEnrollments = await this.enrollmentRepository.find({
          where: { organizationId, batchId: In(myBatchIds), status: 'ACTIVE' },
        });
        const peerStudentIds = Array.from(new Set(peerEnrollments.map(e => e.studentId).filter(id => id !== userId)));
        if (peerStudentIds.length > 0) {
          classmates = await this.userRepository.find({
            where: { id: In(peerStudentIds), organizationId, status: 'ACTIVE', isDeleted: false },
          });
        }
      }
    } else {
      // Admin / Faculty see all active students
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

  // Get messages for any thread (1:1, Batch Group, or Course Forum)
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
          const sender = await this.userRepository.findOne({ where: { id: authorId } });
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

    const sender = await this.userRepository.findOne({ where: { id: authorId } });

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

  // Existing Course Forum methods
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
    const authors = authorIds.length > 0 ? await this.userRepository.find({ where: { id: In(authorIds) } }) : [];
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
