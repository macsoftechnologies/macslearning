import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'COMPLETED'], default: 'ACTIVE' })
  status: string;

  @Prop({ enum: ['PAID', 'NOT_APPLICABLE', 'PENDING'], required: true })
  paymentStatus: string;

  @Prop({ enum: ['SELF_ENROLL', 'ADMIN_ENROLL'], required: true })
  source: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' })
  paymentId: Types.ObjectId;

  @Prop()
  expiresAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
EnrollmentSchema.index(
  { organizationId: 1, studentId: 1, courseId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  }
);
