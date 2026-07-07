import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoQuizDocument = VideoQuiz & Document;

@Schema({ timestamps: true })
export class VideoQuiz {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true })
  lessonId: Types.ObjectId;

  @Prop({ required: true })
  timestampSeconds: number;

  @Prop({ enum: ['MCQ', 'TRUE_FALSE', 'THEORY'], default: 'MCQ' })
  type: string;

  @Prop({ required: true })
  questionText: string;

  @Prop({ type: [{ text: String, isCorrect: Boolean }] })
  options: { text: string; isCorrect: boolean }[];

  @Prop()
  correctAnswer: string;

  @Prop({ default: 1 })
  maxMarks: number;
}

export const VideoQuizSchema = SchemaFactory.createForClass(VideoQuiz);
VideoQuizSchema.index({ lessonId: 1, timestampSeconds: 1 });
