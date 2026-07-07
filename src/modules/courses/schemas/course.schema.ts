import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ trim: true, sparse: true })
  slug: string;

  @Prop()
  description: string;

  @Prop({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' })
  status: string;

  @Prop({ type: { isPaid: Boolean, amount: Number, currency: String }, default: { isPaid: false, amount: 0, currency: 'INR' } })
  pricing: Record<string, any>;

  @Prop([{ regionId: { type: Types.ObjectId, ref: 'Region' }, price: Number }])
  regionalPrices?: { regionId: Types.ObjectId; price: number }[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  instructorIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId: Types.ObjectId;

  @Prop()
  thumbnailUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'CoursePlan' })
  coursePlanId: Types.ObjectId;

  @Prop()
  validityDays: number;

  @Prop({ default: 0 })
  enrolledCount: number;

  @Prop({ type: Types.ObjectId, ref: 'CertificateTemplate' })
  certificateTemplateId?: Types.ObjectId;

  @Prop({ enum: ['AUTO', 'MANUAL_APPROVAL'], default: 'AUTO' })
  certificateIssueMode?: string;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ organizationId: 1, status: 1 });
