import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Thread, ThreadDocument } from './schemas/thread.schema';
import { Reply, ReplyDocument } from './schemas/reply.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectModel(Thread.name) private threadModel: Model<ThreadDocument>,
    @InjectModel(Reply.name) private replyModel: Model<ReplyDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async createThread(organizationId: string, courseId: string, authorId: string, threadData: any) {
    const thread = new this.threadModel({
      ...threadData,
      organizationId,
      courseId,
      authorId,
    });
    const saved = await thread.save();

    // Notify instructors
    try {
      const course = await this.courseModel.findOne({ _id: courseId, organizationId }).lean();
      if (course) {

        // notify all co-instructors
        if (course.instructorIds && course.instructorIds.length > 0) {
          for (const instId of course.instructorIds) {
            if (instId.toString() !== authorId.toString()) {
              await this.notificationsService.createNotification(organizationId, instId.toString(), 'New Course Question', `A new question was asked in ${course.title}`, 'DISCUSSION', `/courses/${courseId}`);
            }
          }
        }
      }
    } catch (e) {}

    return saved;
  }

  async getThreads(organizationId: string, courseId: string, lessonId?: string) {
    const query: any = { organizationId, courseId, isDeleted: false };
    if (lessonId) {
      query.lessonId = lessonId;
    }
    return this.threadModel.find(query)
      .sort({ createdAt: -1 })
      .populate('authorId', 'fullName email userType'); 
  }

  async findThreadById(organizationId: string, courseId: string | undefined, threadId: string) {
    const query: any = { _id: threadId, organizationId, isDeleted: false };
    if (courseId) {
      query.courseId = courseId;
    }
    const thread = await this.threadModel.findOne(query)
      .populate('authorId', 'fullName email userType');
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  async getThreadById(organizationId: string, courseId: string | undefined, threadId: string) {
    const thread = await this.findThreadById(organizationId, courseId, threadId);
    thread.views += 1;
    await thread.save();
    return thread;
  }

  async addReply(organizationId: string, threadId: string, authorId: string, content: string) {
    const thread = await this.threadModel.findOne({ _id: threadId, organizationId, isDeleted: false });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.isResolved) throw new BadRequestException('Cannot reply to a resolved thread');

    const reply = new this.replyModel({
      organizationId,
      threadId,
      authorId,
      content,
    });
    
    await reply.save();
    
    thread.replyCount += 1;
    await thread.save();

    // notify thread author if someone else replied
    try {
      if (thread.authorId.toString() !== authorId.toString()) {
        await this.notificationsService.createNotification(
          thread.organizationId.toString(),
          thread.authorId.toString(),
          'New reply to your thread',
          `Someone replied to your discussion: ${thread.title || thread._id}`,
          'DISCUSSION',
          `/courses/${thread.courseId}/discussions/${thread._id}`
        );
      }
    } catch (e) {}

    return reply.populate('authorId', 'fullName email userType');
  }

  async getReplies(organizationId: string, threadId: string) {
    return this.replyModel.find({ organizationId, threadId, isDeleted: false })
      .sort({ createdAt: 1 })
      .populate('authorId', 'fullName email userType');
  }

  async markReplyAsAccepted(organizationId: string, threadId: string, replyId: string, actorId: string, actorType: string) {
    const thread = await this.threadModel.findOne({ _id: threadId, organizationId, isDeleted: false });
    if (!thread) throw new NotFoundException('Thread not found');

    const isThreadAuthor = thread.authorId.toString() === actorId.toString();
    const isStaff = actorType === 'ORG_USER' || actorType === 'FACULTY';
    if (!isThreadAuthor && !isStaff) {
      throw new BadRequestException('Only the thread author or organization staff can accept a reply');
    }

    const reply = await this.replyModel.findOneAndUpdate(
      { _id: replyId, threadId, organizationId, isDeleted: false },
      { $set: { isAcceptedAnswer: true } },
      { new: true }
    );
    if (!reply) throw new NotFoundException('Reply not found');

    thread.isResolved = true;
    await thread.save();

    return reply;
  }
}
