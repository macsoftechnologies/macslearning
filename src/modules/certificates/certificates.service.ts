import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Certificate, CertificateDocument } from './schemas/certificate.schema';
import PDFDocument from 'pdfkit';
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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
  ) {}

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
      });
      if (!passingRecord) {
        throw new BadRequestException('Cannot generate certificate until the student has a passing assessment result');
      }
    }

    const certificateNumber = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const filename = `${certificateNumber}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'certificates');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fff');
    
    doc.fontSize(40).fillColor('#000').text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(20).text('This is to certify that', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(30).fillColor('#2c3e50').text(student.fullName, { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(20).fillColor('#000').text('has successfully completed the course', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(25).fillColor('#2980b9').text(course.title, { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(15).fillColor('#000').text(`Certificate Number: ${certificateNumber}`, { align: 'center' });
    doc.text(`Issued On: ${new Date().toLocaleDateString()}`, { align: 'center' });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

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
