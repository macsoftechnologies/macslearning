import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Region', default: null })
  regionId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  mobile: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, enum: ['SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT', 'FINANCE'] })
  userType: string;

  @Prop()
  designation: string;

  @Prop([String])
  modulePermissions: string[];

  @Prop([{ type: Types.ObjectId, ref: 'Course' }])
  assignedCourses: Types.ObjectId[];

  @Prop({ enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop()
  emailVerifyToken: string;

  @Prop()
  passwordResetToken: string;

  @Prop()
  passwordResetExpires: Date;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop()
  lockUntil: Date;

  @Prop()
  lastLogin: Date;

  @Prop({
    type: [{
      tokenId: String,
      tokenHash: String,
      issuedAt: Date,
      expiresAt: Date,
      deviceInfo: String,
      ipAddress: String,
      revokedAt: Date,
    }],
    select: false,
  })
  refreshTokens: any[];

  @Prop()
  rejectionReason: string;

  @Prop()
  rejectedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  rejectedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy: Types.ObjectId;

  @Prop({ default: null })
  approvedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
UserSchema.index(
  { organizationId: 1, mobile: 1 },
  {
    unique: true,
    partialFilterExpression: { mobile: { $exists: true, $ne: null } },
  },
);
