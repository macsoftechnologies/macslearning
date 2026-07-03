import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubmissionDocument = Submission & Document;

@Schema({ timestamps: true })
export class Submission {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Assignment', required: true })
  assignmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ required: true })
  fileUrl: string; // The uploaded assignment

  @Prop({ enum: ['PENDING', 'GRADED', 'REJECTED'], default: 'PENDING' })
  status: string;

  @Prop({ default: false })
  isLate: boolean;

  @Prop({ default: 0 })
  marksObtained: number;

  @Prop()
  feedback: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy: Types.ObjectId;

  @Prop()
  gradedAt: Date;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
