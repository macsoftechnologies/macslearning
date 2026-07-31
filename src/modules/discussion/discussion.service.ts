import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Thread } from './entities/thread.entity';
import { Reply } from './entities/reply.entity';
import { Course } from '../courses/entities/course.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(Thread) private threadRepository: Repository<Thread>,
    @InjectRepository(Reply) private replyRepository: Repository<Reply>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    private notificationsService: NotificationsService,
  ) {}

  async createThread(
    organizationId: string,
    courseId: string,
    authorId: string,
    threadData: any,
  ) {
    const thread = this.threadRepository.create({
      ...threadData,
      organizationId,
      courseId,
      authorId,
    });
    const saved = await this.threadRepository.save(thread);

    // Notify instructors
    try {
      const course = await this.courseRepository.findOne({
        where: { id: courseId, organizationId },
      });
      if (course) {
        // notify all co-instructors
        let instructorIds = course.instructorIds || [];
        if (typeof instructorIds === 'string')
          instructorIds = JSON.parse(instructorIds);

        if (instructorIds && instructorIds.length > 0) {
          for (const instId of instructorIds) {
            if (instId !== authorId) {
              await this.notificationsService.createNotification(
                organizationId,
                instId,
                'New Course Question',
                `A new question was asked in ${course.title}`,
                'DISCUSSION',
                `/courses/${courseId}`,
              );
            }
          }
        }
      }
    } catch (e) {}

    return saved;
  }

  async getThreads(
    organizationId: string,
    courseId: string,
    lessonId?: string,
  ) {
    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoin(User, 'author', 'author.id = thread.authorId')
      .where('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.courseId = :courseId', { courseId })
      .andWhere('thread.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'thread.*',
        'author.id as author_id',
        'author.fullName as author_fullName',
        'author.email as author_email',
        'author.userType as author_userType',
      ])
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(reply.id)', 'actualReplyCount')
            .from(Reply, 'reply')
            .where('reply.threadId = thread.id'),
        'actualReplyCount',
      )
      .orderBy('thread.createdAt', 'DESC');

    if (lessonId) {
      queryBuilder.andWhere('thread.lessonId = :lessonId', { lessonId });
    }

    const threads = await queryBuilder.getRawMany();
    return threads.map((t) => ({
      ...t,
      authorId: {
        _id: t.author_id,
        id: t.author_id,
        fullName: t.author_fullName,
        email: t.author_email,
        userType: t.author_userType,
      },
    }));
  }

  async findThreadById(
    organizationId: string,
    courseId: string | undefined,
    threadId: string,
  ) {
    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoin(User, 'author', 'author.id = thread.authorId')
      .where('thread.id = :threadId', { threadId })
      .andWhere('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'thread.*',
        'author.id as author_id',
        'author.fullName as author_fullName',
        'author.email as author_email',
        'author.userType as author_userType',
      ]);

    if (courseId) {
      queryBuilder.andWhere('thread.courseId = :courseId', { courseId });
    }

    const t = await queryBuilder.getRawOne();
    if (!t) {
      throw new NotFoundException('Thread not found');
    }
    return {
      ...t,
      authorId: {
        _id: t.author_id,
        id: t.author_id,
        fullName: t.author_fullName,
        email: t.author_email,
        userType: t.author_userType,
      },
    };
  }

  async getThreadById(
    organizationId: string,
    courseId: string | undefined,
    threadId: string,
  ) {
    const threadInfo = await this.findThreadById(
      organizationId,
      courseId,
      threadId,
    );
    await this.threadRepository.update(
      { id: threadId },
      { views: (threadInfo.views || 0) + 1 },
    );
    threadInfo.views = (threadInfo.views || 0) + 1;
    return threadInfo;
  }

  async addReply(
    organizationId: string,
    threadId: string,
    authorId: string,
    content: string,
  ) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, organizationId, isDeleted: false },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.isResolved)
      throw new BadRequestException('Cannot reply to a resolved thread');

    const reply = this.replyRepository.create({
      organizationId,
      threadId,
      authorId,
      content,
    });

    await this.replyRepository.save(reply);

    thread.replyCount = (thread.replyCount || 0) + 1;
    await this.threadRepository.save(thread);

    // notify thread author if someone else replied
    try {
      if (thread.authorId !== authorId) {
        await this.notificationsService.createNotification(
          thread.organizationId,
          thread.authorId,
          'New reply to your thread',
          `Someone replied to your discussion: ${thread.title || thread.id}`,
          'DISCUSSION',
          `/courses/${thread.courseId}/discussions/${thread.id}`,
        );
      }
    } catch (e) {}

    const r = await this.replyRepository
      .createQueryBuilder('reply')
      .leftJoin(User, 'author', 'author.id = reply.authorId')
      .where('reply.id = :replyId', { replyId: reply.id })
      .select([
        'reply.*',
        'author.id as author_id',
        'author.fullName as author_fullName',
        'author.email as author_email',
        'author.userType as author_userType',
      ])
      .getRawOne();

    return {
      ...r,
      authorId: {
        _id: r.author_id,
        id: r.author_id,
        fullName: r.author_fullName,
        email: r.author_email,
        userType: r.author_userType,
      },
    };
  }

  async getReplies(organizationId: string, threadId: string) {
    const replies = await this.replyRepository
      .createQueryBuilder('reply')
      .leftJoin(User, 'author', 'author.id = reply.authorId')
      .where('reply.organizationId = :organizationId', { organizationId })
      .andWhere('reply.threadId = :threadId', { threadId })
      .andWhere('reply.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'reply.*',
        'author.id as author_id',
        'author.fullName as author_fullName',
        'author.email as author_email',
        'author.userType as author_userType',
      ])
      .orderBy('reply.createdAt', 'ASC')
      .getRawMany();

    return replies.map((r) => ({
      ...r,
      authorId: {
        _id: r.author_id,
        id: r.author_id,
        fullName: r.author_fullName,
        email: r.author_email,
        userType: r.author_userType,
      },
    }));
  }

  async markReplyAsAccepted(
    organizationId: string,
    threadId: string,
    replyId: string,
    actorId: string,
    actorType: string,
  ) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, organizationId, isDeleted: false },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const isThreadAuthor = thread.authorId === actorId;
    const isStaff = actorType === 'ORG_USER' || actorType === 'FACULTY';
    if (!isThreadAuthor && !isStaff) {
      throw new BadRequestException(
        'Only the thread author or organization staff can accept a reply',
      );
    }

    await this.replyRepository.update(
      { id: replyId, threadId, organizationId, isDeleted: false },
      { isAcceptedAnswer: true },
    );
    const reply = await this.replyRepository.findOne({
      where: { id: replyId, threadId, organizationId, isDeleted: false },
    });
    if (!reply) throw new NotFoundException('Reply not found');

    thread.isResolved = true;
    await this.threadRepository.save(thread);

    return reply;
  }
}
