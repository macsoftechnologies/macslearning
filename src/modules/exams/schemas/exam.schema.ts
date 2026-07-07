import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExamDocument = Exam & Document;

@Schema({ timestamps: true })
export class Exam {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  durationMinutes: number;

  @Prop({ required: true })
  passingPercentage: number;

  @Prop({ required: true })
  totalMarks: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' })
  status: string;

  @Prop({ default: false })
  isFinalExam: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
ExamSchema.index({ organizationId: 1, courseId: 1 });
