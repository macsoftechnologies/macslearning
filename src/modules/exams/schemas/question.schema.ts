import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema({ timestamps: true })
export class Question {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  questionText: string;

  @Prop()
  videoUrl: string;

  @Prop({ enum: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'], required: true })
  type: string;

  @Prop({ type: [{ text: String, isCorrect: Boolean }] })
  options: { text: string; isCorrect: boolean }[];

  @Prop({ required: true })
  marks: number;

  @Prop({ default: 0 })
  orderIndex: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ examId: 1 });
