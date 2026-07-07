import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CoursePlanDocument = CoursePlan & Document;

@Schema({ timestamps: true })
export class CoursePlan {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  validityDays: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const CoursePlanSchema = SchemaFactory.createForClass(CoursePlan);
CoursePlanSchema.index({ organizationId: 1 });
