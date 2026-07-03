import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop()
  logoUrl: string;

  @Prop({ type: Object })
  themeColors: Record<string, string>;

  @Prop({ type: Object })
  contactInfo: {
    email: string;
    phone: string;
    address: string;
  };

  @Prop({ enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @Prop()
  slug: string;

  @Prop()
  loginUrl: string;

  @Prop({ type: Object })
  subscriptionConfig: {
    planId?: Types.ObjectId;
    planType?: string;
    billingCycle?: string;
    maxStudents?: number;
    maxStorageGB?: number;
    expiresAt?: Date;
  };

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
