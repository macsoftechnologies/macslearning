import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ enum: ['COURSE_PURCHASE'], default: 'COURSE_PURCHASE' })
  paymentType: string;

  @Prop({ enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'], default: 'COMPLETED' })
  status: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ required: true, unique: true })
  dummyPaymentId: string;

  @Prop({ default: true })
  isPaid: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Enrollment' })
  enrollmentId: Types.ObjectId;

  @Prop()
  invoiceNumber: string;

  @Prop({ enum: ['PENDING', 'GENERATED', 'FAILED'], default: 'PENDING' })
  invoiceGenerationStatus: string;

  @Prop()
  invoicePath: string;

  @Prop()
  invoiceGeneratedAt: Date;

  @Prop()
  paidAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ organizationId: 1, studentId: 1, courseId: 1 });
PaymentSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
