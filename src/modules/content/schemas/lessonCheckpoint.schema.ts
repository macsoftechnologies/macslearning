import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonCheckpointDocument = LessonCheckpoint & Document;

@Schema({ timestamps: true })
export class LessonCheckpoint {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true })
  lessonId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true })
  moduleId: Types.ObjectId;

  @Prop({ required: true })
  questionText: string;

  @Prop({ required: true })
  timestampSeconds: number;

  @Prop({ enum: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'], required: true })
  type: string;

  @Prop({ type: [{ text: String, isCorrect: Boolean }] })
  options: { text: string; isCorrect: boolean }[];

  @Prop({ default: true })
  required: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const LessonCheckpointSchema = SchemaFactory.createForClass(LessonCheckpoint);
LessonCheckpointSchema.index({ lessonId: 1, organizationId: 1 });
