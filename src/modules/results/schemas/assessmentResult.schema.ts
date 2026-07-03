import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssessmentResultDocument = AssessmentResult & Document;

@Schema({ timestamps: true })
export class AssessmentResult {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Attempt', required: true })
  attemptId: Types.ObjectId;

  @Prop({ required: true })
  marksObtained: number;

  @Prop({ required: true })
  totalMarks: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({ required: true })
  isPassed: boolean;

  @Prop({ default: false })
  isPublished: boolean;

  @Prop()
  publishedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy: Types.ObjectId;
}

export const AssessmentResultSchema = SchemaFactory.createForClass(AssessmentResult);
AssessmentResultSchema.index({ examId: 1, studentId: 1 });
