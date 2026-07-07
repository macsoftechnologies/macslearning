import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CertificateTemplateDocument = CertificateTemplate & Document;

@Schema({ _id: false })
export class TemplateField {
  @Prop({ required: true })
  type: string; // 'text' or 'image'

  @Prop()
  variable?: string; // e.g. 'student_name', 'course_title', 'completion_date', 'marks'

  @Prop()
  value?: string; // For hardcoded text

  @Prop()
  url?: string; // For image type (e.g. signature URL)

  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop()
  width?: number; // Primarily for images

  @Prop()
  height?: number; // Primarily for images

  @Prop()
  fontSize?: number;

  @Prop()
  fontFamily?: string;

  @Prop()
  color?: string;

  @Prop()
  textAlign?: string;
}

const TemplateFieldSchema = SchemaFactory.createForClass(TemplateField);

@Schema({ timestamps: true })
export class CertificateTemplate {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'BLANK' })
  backgroundType: string; // 'BLANK' or 'IMAGE'

  @Prop()
  backgroundImageUrl?: string;

  @Prop({ type: [TemplateFieldSchema], default: [] })
  fields: TemplateField[];
}

export const CertificateTemplateSchema = SchemaFactory.createForClass(CertificateTemplate);
