import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ThreadDocument = Thread & Document;

@Schema({ timestamps: true })
export class Thread {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: false })
  lessonId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  replyCount: number;

  @Prop({ default: false })
  isResolved: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ThreadSchema = SchemaFactory.createForClass(Thread);
ThreadSchema.index({ organizationId: 1, courseId: 1 });
