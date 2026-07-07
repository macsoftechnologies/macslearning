import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoQuizAnswerDocument = VideoQuizAnswer & Document;

@Schema({ timestamps: true })
export class VideoQuizAnswer {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true })
  lessonId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'VideoQuiz', required: true })
  quizId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop()
  selectedOption?: string;

  @Prop()
  textAnswer?: string;

  @Prop({ default: false })
  isCorrect: boolean;

  @Prop({ default: false })
  isGraded: boolean;

  @Prop({ default: 0 })
  marks: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy?: Types.ObjectId;

  @Prop()
  gradedAt?: Date;
}

export const VideoQuizAnswerSchema = SchemaFactory.createForClass(VideoQuizAnswer);
VideoQuizAnswerSchema.index({ quizId: 1, studentId: 1 });
VideoQuizAnswerSchema.index({ lessonId: 1 });
