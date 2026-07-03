import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttemptDocument = Attempt & Document;

@Schema({ timestamps: true })
export class Attempt {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ default: 1 })
  attemptNumber: number;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ enum: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'], default: 'IN_PROGRESS' })
  status: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  submittedAt: Date;

  @Prop({ type: [{ questionId: { type: Types.ObjectId, ref: 'Question' }, selectedOption: String, textAnswer: String }] })
  answers: { questionId: Types.ObjectId; selectedOption?: string; textAnswer?: string; isCorrect?: boolean; marks?: number; isGraded?: boolean }[];

  @Prop({ default: 0 })
  marksObtained: number;

  @Prop({ required: true })
  totalMarks: number;

  @Prop({ default: 0 })
  percentage: number;

  @Prop({ default: false })
  isPassed: boolean;
}

export const AttemptSchema = SchemaFactory.createForClass(Attempt);
AttemptSchema.index({ examId: 1, studentId: 1 });
