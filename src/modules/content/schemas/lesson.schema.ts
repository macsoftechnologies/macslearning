import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonDocument = Lesson & Document;

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true })
  moduleId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ enum: ['VIDEO', 'PDF', 'TEXT', 'INTERACTIVE'], required: true })
  type: string;

  @Prop()
  contentUrl: string; // URL to an uploaded file attachment

  @Prop()
  videoUrl: string; // External video URL (YouTube, Vimeo, direct mp4 link)

  @Prop({ default: 0 })
  durationMinutes: number;

  @Prop({ default: 0 })
  orderIndex: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
LessonSchema.index({ organizationId: 1, courseId: 1, moduleId: 1 });
