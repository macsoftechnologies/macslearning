import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Certificate, CertificateDocument } from './schemas/certificate.schema';
import { CertificateTemplate, CertificateTemplateDocument } from './schemas/certificate-template.schema';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { AssessmentResult, AssessmentResultDocument } from '../results/schemas/assessmentResult.schema';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectModel(Certificate.name) private certificateModel: Model<CertificateDocument>,
    @InjectModel(CertificateTemplate.name) private templateModel: Model<CertificateTemplateDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
  ) {}

  // Template Methods
  async createTemplate(organizationId: string, data: any) {
    const template = new this.templateModel({ ...data, organizationId });
    return template.save();
  }

  async listTemplates(organizationId: string) {
    return this.templateModel.find({ organizationId }).sort({ createdAt: -1 });
  }

  async getTemplateById(templateId: string, organizationId: string) {
    const template = await this.templateModel.findOne({ _id: templateId, organizationId });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(templateId: string, organizationId: string, updateData: any) {
    const template = await this.templateModel.findOneAndUpdate(
      { _id: templateId, organizationId },
      { $set: updateData },
      { new: true }
    );
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async deleteTemplate(templateId: string, organizationId: string) {
    const template = await this.templateModel.findOneAndDelete({ _id: templateId, organizationId });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async generateCertificate(organizationId: string, issuerId: string, studentId: string, courseId: string, override: boolean) {
    const existing = await this.certificateModel.findOne({ organizationId, studentId, courseId });
    if (existing && !override) {
      return existing;
    }

    const student = await this.userModel.findOne({ _id: studentId, organizationId, userType: 'STUDENT', isDeleted: false });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const course = await this.courseModel.findOne({ _id: courseId, organizationId, isDeleted: false });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!override) {
      const passingRecord = await this.resultModel.findOne({
        organizationId,
        studentId,
        courseId,
        isPassed: true,
        isPublished: true,
      });
      if (!passingRecord) {
        throw new BadRequestException('Cannot generate certificate until the student has a published passing assessment result');
      }
    }

    // Try to find the template
    let template = null;
    if (course.certificateTemplateId) {
      template = await this.templateModel.findById(course.certificateTemplateId);
    }

    const certificateNumber = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const filename = `${certificateNumber}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'certificates');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    const page = pdfDoc.addPage([842, 595]); // A4 Landscape

    if (template) {
      // Custom Template logic
      if (template.backgroundType === 'IMAGE' && template.backgroundImageUrl) {
        try {
          const bgPath = path.join(process.cwd(), 'public', template.backgroundImageUrl);
          const imageBytes = fs.readFileSync(bgPath);
          const bgImage = template.backgroundImageUrl.toLowerCase().endsWith('.png') 
            ? await pdfDoc.embedPng(imageBytes) 
            : await pdfDoc.embedJpg(imageBytes);
            
          page.drawImage(bgImage, {
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
          });
        } catch (e) {
          console.error('Failed to load background image', e);
        }
      }

      const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const field of template.fields) {
        if (field.type === 'text') {
          let textToDraw = field.value || '';
          if (field.variable === 'student_name') textToDraw = student.fullName;
          if (field.variable === 'course_title') textToDraw = course.title;
          if (field.variable === 'completion_date') textToDraw = new Date().toLocaleDateString();
          if (field.variable === 'certificate_number') textToDraw = certificateNumber;
          
          let color = rgb(0, 0, 0);
          if (field.color) {
            // Very naive hex parser (assumes #RRGGBB)
            try {
              const r = parseInt(field.color.substring(1, 3), 16) / 255;
              const g = parseInt(field.color.substring(3, 5), 16) / 255;
              const b = parseInt(field.color.substring(5, 7), 16) / 255;
              color = rgb(r, g, b);
            } catch (e) {}
          }
          
          const fontSize = field.fontSize || 16;
          const textWidth = defaultFont.widthOfTextAtSize(textToDraw, fontSize);
          
          // field.x and field.y represent the center of the text box in the top-left coordinate system
          const pdfX = field.x - (textWidth / 2);
          const pdfY = page.getHeight() - field.y - (fontSize / 2);

          page.drawText(textToDraw, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: defaultFont,
            color,
          });
        } else if (field.type === 'image' && field.url) {
          try {
            const imgPath = path.join(process.cwd(), 'public', field.url);
            const imgBytes = fs.readFileSync(imgPath);
            const embeddedImg = field.url.toLowerCase().endsWith('.png')
              ? await pdfDoc.embedPng(imgBytes)
              : await pdfDoc.embedJpg(imgBytes);
            
            // Adjust y for images based on center origin
            const width = field.width || embeddedImg.width;
            const height = field.height || embeddedImg.height;
            const pdfX = field.x - (width / 2);
            const imgPdfY = page.getHeight() - field.y - (height / 2);
            
            page.drawImage(embeddedImg, {
              x: pdfX,
              y: imgPdfY,
              width,
              height,
            });
          } catch (e) {
            console.error('Failed to draw image field', e);
          }
        }
      }
    } else {
      // Fallback Default Certificate
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText('Certificate of Completion', { x: 200, y: 450, size: 40, font, color: rgb(0,0,0) });
      page.drawText('This is to certify that', { x: 300, y: 380, size: 20, font });
      page.drawText(student.fullName, { x: 300, y: 330, size: 30, font, color: rgb(0.17, 0.24, 0.31) });
      page.drawText('has successfully completed the course', { x: 250, y: 280, size: 20, font });
      page.drawText(course.title, { x: 250, y: 230, size: 25, font, color: rgb(0.16, 0.5, 0.72) });
      page.drawText(`Certificate Number: ${certificateNumber}`, { x: 300, y: 150, size: 15, font });
      page.drawText(`Issued On: ${new Date().toLocaleDateString()}`, { x: 300, y: 130, size: 15, font });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);

    const certificateUrl = `/uploads/certificates/${filename}`;

    if (existing && override) {
      existing.certificateNumber = certificateNumber;
      existing.certificateUrl = certificateUrl;
      existing.issuedAt = new Date();
      return existing.save();
    }

    const certificate = new this.certificateModel({
      organizationId,
      studentId,
      courseId,
      certificateNumber,
      certificateUrl,
    });

    return certificate.save();
  }

  async getMyCertificates(organizationId: string, studentId: string) {
    return this.certificateModel.find({ organizationId, studentId }).populate('courseId', 'title');
  }

  async getCertificateById(certificateId: string, organizationId?: string, studentId?: string) {
    const query: any = { _id: certificateId };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    if (studentId) {
      query.studentId = studentId;
    }

    const cert = await this.certificateModel.findOne(query).populate('courseId', 'title').populate('studentId', 'fullName email');
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }
}
