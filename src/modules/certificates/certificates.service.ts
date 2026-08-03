import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './entities/certificate.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';
import { Program } from '../programs/entities/program.entity';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
    @InjectRepository(CertificateTemplate)
    private templateRepository: Repository<CertificateTemplate>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(AssessmentResult)
    private resultRepository: Repository<AssessmentResult>,
    @InjectRepository(Program) private programRepository: Repository<Program>,
    @InjectRepository(OfflineGrade) private offlineGradeRepository: Repository<OfflineGrade>,
  ) {}

  // Template Methods
  async createTemplate(organizationId: string, data: any) {
    const template = this.templateRepository.create({
      ...data,
      organizationId,
    });
    return this.templateRepository.save(template);
  }

  async listTemplates(organizationId: string) {
    return this.templateRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTemplateById(templateId: string, organizationId: string) {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organizationId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  private async generatePdfBytes(template: any, studentName: string, title: string, certificateNumber: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([842, 595]); // A4 Landscape

    if (template) {
      if (template.backgroundType === 'IMAGE' && template.backgroundImageUrl) {
        try {
          const bgPath = path.join(process.cwd(), 'public', template.backgroundImageUrl);
          if (fs.existsSync(bgPath)) {
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
          }
        } catch (e) {
          console.error('Failed to load background image', e);
        }
      }

      const defaultFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      for (const field of (template.fields || []).filter((f: any) => f.type === 'image')) {
        if (field.url) {
          try {
            const imgPath = path.join(process.cwd(), 'public', field.url);
            if (fs.existsSync(imgPath)) {
              const imgBytes = fs.readFileSync(imgPath);
              const embeddedImg = field.url.toLowerCase().endsWith('.png')
                ? await pdfDoc.embedPng(imgBytes)
                : await pdfDoc.embedJpg(imgBytes);

              const width = field.width || embeddedImg.width;
              const height = field.height || embeddedImg.height;
              const pdfX = field.x - width / 2;
              const imgPdfY = page.getHeight() - field.y - height / 2;

              page.drawImage(embeddedImg, {
                x: pdfX,
                y: imgPdfY,
                width,
                height,
                opacity: field.opacity !== undefined ? field.opacity : 1,
              });
            }
          } catch (e) {
            console.error('Failed to draw image field', e);
          }
        }
      }

      for (const field of (template.fields || []).filter((f: any) => f.type === 'text')) {
        let textToDraw = field.value || '';
        if (field.variable === 'student_name') textToDraw = studentName;
        if (field.variable === 'course_title') textToDraw = title;
        if (field.variable === 'completion_date') textToDraw = new Date().toLocaleDateString();
        if (field.variable === 'certificate_number') textToDraw = certificateNumber;

        let color = rgb(0, 0, 0);
        if (field.color) {
          try {
            const r = parseInt(field.color.substring(1, 3), 16) / 255;
            const g = parseInt(field.color.substring(3, 5), 16) / 255;
            const b = parseInt(field.color.substring(5, 7), 16) / 255;
            color = rgb(r, g, b);
          } catch (e) {}
        }

        const fontSize = (field.fontSize || 16) * 0.9;
        const textWidth = defaultFont.widthOfTextAtSize(textToDraw, fontSize);
        const pdfX = field.x - textWidth / 2;
        const pdfY = page.getHeight() - field.y - fontSize / 2.5;

        page.drawText(textToDraw, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font: defaultFont,
          color,
        });
      }
    } else {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText('Certificate of Completion', {
        x: 200,
        y: 450,
        size: 40,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      page.drawText('This is to certify that', { x: 300, y: 380, size: 20, font });
      page.drawText(studentName, {
        x: 300,
        y: 330,
        size: 30,
        font: boldFont,
        color: rgb(0.17, 0.24, 0.31),
      });
      page.drawText('has successfully completed the requirements for', { x: 250, y: 280, size: 20, font });
      page.drawText(title, {
        x: 250,
        y: 230,
        size: 25,
        font: boldFont,
        color: rgb(0.16, 0.5, 0.72),
      });
      page.drawText(`Certificate Number: ${certificateNumber}`, { x: 300, y: 150, size: 15, font });
      page.drawText(`Issued On: ${new Date().toLocaleDateString()}`, { x: 300, y: 130, size: 15, font });
    }

    return pdfDoc.save();
  }

  async updateTemplate(
    templateId: string,
    organizationId: string,
    updateData: any,
  ) {
    await this.templateRepository.update(
      { id: templateId, organizationId },
      updateData,
    );
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organizationId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async deleteTemplate(templateId: string, organizationId: string) {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organizationId },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.templateRepository.delete({ id: templateId, organizationId });
    return template;
  }

  async generateCertificate(
    organizationId: string,
    issuerId: string,
    studentId: string,
    courseId: string,
    override: boolean,
  ) {
    const existing = await this.certificateRepository.findOne({
      where: { organizationId, studentId, courseId },
    });
    if (existing && !override) {
      return existing;
    }

    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const course = await this.courseRepository.findOne({
      where: { id: courseId, organizationId, isDeleted: false },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!override) {
      const passingRecord = await this.resultRepository.findOne({
        where: {
          organizationId,
          studentId,
          courseId,
          isPassed: true,
          isPublished: true,
        },
      });
      if (!passingRecord) {
        // Fallback to checking manual grades
        const offlineGrade = await this.offlineGradeRepository.findOne({
          where: { studentId, courseId, organizationId }
        });
        
        if (!offlineGrade) {
          throw new BadRequestException(
            'Cannot generate certificate until the student has a published passing assessment result or manual grade',
          );
        }
      }
    }

    // Try to find the template
    let template = null;
    if (course.certificateTemplateId) {
      template = await this.templateRepository.findOne({
        where: { id: course.certificateTemplateId, organizationId },
      });
    }

    const certificateNumber = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const filename = `${certificateNumber}.pdf`;
    const uploadsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'certificates',
    );

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    const pdfBytes = await this.generatePdfBytes(template, student.fullName, course.title, certificateNumber);
    fs.writeFileSync(filePath, pdfBytes);

    const certificateUrl = `/uploads/certificates/${filename}`;

    if (existing && override) {
      existing.certificateNumber = certificateNumber;
      existing.certificateUrl = certificateUrl;
      existing.issuedAt = new Date();
      return this.certificateRepository.save(existing);
    }

    const certificate = this.certificateRepository.create({
      organizationId,
      studentId,
      courseId,
      certificateNumber,
      certificateUrl,
    });

    return this.certificateRepository.save(certificate);
  }

  async previewCourseCertificate(
    organizationId: string,
    studentId: string,
    courseId: string,
  ) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
    });
    if (!student) throw new NotFoundException('Student not found');

    const course = await this.courseRepository.findOne({
      where: { id: courseId, organizationId, isDeleted: false },
    });
    if (!course) throw new NotFoundException('Course not found');

    let template = null;
    if (course.certificateTemplateId) {
      template = await this.templateRepository.findOne({
        where: { id: course.certificateTemplateId },
      });
    }

    const certificateNumber = `CERT-PREVIEW`;
    const pdfBytes = await this.generatePdfBytes(template, student.fullName, course.title, certificateNumber);
    return Buffer.from(pdfBytes).toString('base64');
  }

  async generateDegreeCertificate(
    organizationId: string,
    studentId: string,
    programId: string,
    batchId: string,
  ) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
    });
    if (!student) throw new NotFoundException('Student not found');

    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    // Get all courses for this program
    const courses = await this.courseRepository.find({
      where: { organizationId, programId, status: 'PUBLISHED' },
    });

    if (!courses.length) {
      throw new BadRequestException('No published courses found in this program');
    }

    // Verify student has passed all courses via offline_grades
    const courseIds = courses.map(c => c.id);
    const offlineGrades = await this.offlineGradeRepository.createQueryBuilder('grade')
      .where('grade.studentId = :studentId', { studentId })
      .andWhere('grade.organizationId = :organizationId', { organizationId })
      .andWhere('grade.academicBatchId = :batchId', { batchId })
      .andWhere('grade.courseId IN (:...courseIds)', { courseIds })
      .getMany();

    const passedCourses = offlineGrades.filter(g => g.totalScore >= 40);
    
    if (passedCourses.length < courses.length) {
      throw new BadRequestException(`Cannot generate degree. Student has passed ${passedCourses.length} out of ${courses.length} courses.`);
    }

    // Generate degree PDF
    const certificateNumber = `DEG-${uuidv4().substring(0, 8).toUpperCase()}`;
    const filename = `${certificateNumber}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'certificates');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    // Try to find the template
    let template = null;
    if (program.certificateTemplateId) {
      template = await this.templateRepository.findOne({
        where: { id: program.certificateTemplateId, organizationId },
      });
    }

    const pdfBytes = await this.generatePdfBytes(template, student.fullName, program.name, certificateNumber);
    fs.writeFileSync(filePath, pdfBytes);

    const certificateUrl = `/uploads/certificates/${filename}`;

    const existing = await this.certificateRepository.findOne({
      where: { organizationId, studentId, courseId: programId }
    });

    if (existing) {
      existing.certificateNumber = certificateNumber;
      existing.certificateUrl = certificateUrl;
      existing.issuedAt = new Date();
      return this.certificateRepository.save(existing);
    }

    const certificate = this.certificateRepository.create({
      organizationId,
      studentId,
      courseId: programId, // Hack for now to reuse entity without adding programId
      certificateNumber,
      certificateUrl,
    });

    return this.certificateRepository.save(certificate);
  }

  async previewDegreeCertificate(
    organizationId: string,
    studentId: string,
    programId: string,
  ) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
    });
    if (!student) throw new NotFoundException('Student not found');

    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    let template = null;
    if (program.certificateTemplateId) {
      template = await this.templateRepository.findOne({
        where: { id: program.certificateTemplateId, organizationId },
      });
    }

    const certificateNumber = `DEG-PREVIEW`;
    const pdfBytes = await this.generatePdfBytes(template, student.fullName, program.name, certificateNumber);
    return Buffer.from(pdfBytes).toString('base64');
  }

  async getMyCertificates(organizationId: string, studentId: string) {
    // In TypeORM, to populate we use a query builder if relations aren't strictly mapped or leftJoin
    const certificates = await this.certificateRepository
      .createQueryBuilder('cert')
      .leftJoin(Course, 'course', 'course.id = cert.courseId')
      .select([
        'cert.*',
        'course.id as course_id',
        'course.title as course_title',
      ])
      .where('cert.organizationId = :organizationId', { organizationId })
      .andWhere('cert.studentId = :studentId', { studentId })
      .getRawMany();

    // Map raw data back to expected mongoose-like populated shape for frontend
    return certificates.map((c) => ({
      _id: c.id,
      id: c.id,
      organizationId: c.organizationId,
      studentId: c.studentId,
      courseId: { _id: c.course_id, id: c.course_id, title: c.course_title },
      certificateNumber: c.certificateNumber,
      certificateUrl: c.certificateUrl,
      issuedAt: c.issuedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCourseCertificates(organizationId: string, courseId: string) {
    const certificates = await this.certificateRepository
      .createQueryBuilder('cert')
      .leftJoin(User, 'student', 'student.id = cert.studentId')
      .leftJoin(Course, 'course', 'course.id = cert.courseId')
      .where('cert.organizationId = :organizationId', { organizationId })
      .andWhere('cert.courseId = :courseId', { courseId })
      .select([
        'cert.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'course.id as course_id',
        'course.title as course_title',
      ])
      .getRawMany();

    return certificates.map((c) => ({
      _id: c.id,
      id: c.id,
      organizationId: c.organizationId,
      studentId: {
        _id: c.student_id,
        id: c.student_id,
        fullName: c.student_fullName,
        email: c.student_email,
      },
      courseId: { _id: c.course_id, id: c.course_id, title: c.course_title },
      certificateNumber: c.certificateNumber,
      certificateUrl: c.certificateUrl,
      issuedAt: c.issuedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCertificateById(
    certificateId: string,
    organizationId?: string,
    studentId?: string,
  ) {
    const queryBuilder = this.certificateRepository
      .createQueryBuilder('cert')
      .leftJoin(Course, 'course', 'course.id = cert.courseId')
      .leftJoin(User, 'student', 'student.id = cert.studentId')
      .select([
        'cert.*',
        'course.id as course_id',
        'course.title as course_title',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
      ])
      .where('cert.id = :certificateId', { certificateId });

    if (organizationId) {
      queryBuilder.andWhere('cert.organizationId = :organizationId', {
        organizationId,
      });
    }
    if (studentId) {
      queryBuilder.andWhere('cert.studentId = :studentId', { studentId });
    }

    const c = await queryBuilder.getRawOne();

    if (!c) throw new NotFoundException('Certificate not found');

    return {
      _id: c.id,
      id: c.id,
      organizationId: c.organizationId,
      studentId: {
        _id: c.student_id,
        id: c.student_id,
        fullName: c.student_fullName,
        email: c.student_email,
      },
      courseId: { _id: c.course_id, id: c.course_id, title: c.course_title },
      certificateNumber: c.certificateNumber,
      certificateUrl: c.certificateUrl,
      issuedAt: c.issuedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
