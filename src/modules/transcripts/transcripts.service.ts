import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TranscriptsService {
  constructor(
    @InjectRepository(OfflineGrade) private offlineGradeRepository: Repository<OfflineGrade>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async generatePdf(organizationId: string, studentId: string, conduct: string, awards: string): Promise<Buffer> {
    const student = await this.userRepository.findOne({ where: { id: studentId, organizationId, isDeleted: false } });
    if (!student) throw new NotFoundException('Student not found');

    const allGrades = await this.offlineGradeRepository.find({
      where: { studentId, organizationId },
      order: { updatedAt: 'DESC' }
    });
    // Deduplicate by courseId (keep latest)
    const uniqueMap = new Map<string, OfflineGrade>();
    for (const g of allGrades) {
      if (!uniqueMap.has(g.courseId)) {
        uniqueMap.set(g.courseId, g);
      }
    }
    const grades = Array.from(uniqueMap.values());
    const courseIds = [...new Set(grades.map(g => g.courseId))];
    const courses = courseIds.length > 0 
      ? await this.courseRepository.createQueryBuilder('course')
          .where('course.id IN (:...courseIds)', { courseIds })
          .andWhere('course.organizationId = :organizationId', { organizationId })
          .getMany() 
      : [];

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Header
        doc.fontSize(20).text('GLOBAL ONLINE – with ATA Reg. Number.', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text('COTR Theological Seminary', { align: 'center' });
        doc.fontSize(12).text('Academic Record', { align: 'center' });
        doc.moveDown();
        
        // Student Info
        doc.fontSize(12).text(`Student Name: ${student.fullName}`);
        doc.text(`Student ID: ${studentId}`);
        doc.text(`Conduct: ${conduct || 'Satisfactory'}`);
        doc.text(`Awards / Class: ${awards || 'None'}`);
        doc.moveDown();

        // Table Header
        doc.text('-------------------------------------------------------------');
        doc.text('Course Name | Score | Grade');
        doc.text('-------------------------------------------------------------');
        
        // Render Real Grades
        let totalScore = 0;
        grades.forEach(grade => {
          const courseTitle = courses.find(c => c.id === grade.courseId)?.title || 'Unknown Course';
          doc.text(`${courseTitle.padEnd(30, ' ').substring(0, 30)} | ${grade.totalScore} | ${grade.grade}`);
          totalScore += Number(grade.totalScore);
        });
        
        doc.text('-------------------------------------------------------------');
        const avgScore = grades.length > 0 ? (totalScore / grades.length).toFixed(2) : '0';
        doc.text(`Average Score: ${avgScore}`);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }



  async getMyGrades(organizationId: string, studentId: string) {
    const allGrades = await this.offlineGradeRepository.find({
      where: { studentId, organizationId },
      order: { updatedAt: 'DESC' }
    });
    if (allGrades.length === 0) return { grades: [], totalCredits: 0, averageScore: 0 };

    // Deduplicate by courseId (keep latest)
    const uniqueMap = new Map<string, OfflineGrade>();
    for (const g of allGrades) {
      if (!uniqueMap.has(g.courseId)) {
        uniqueMap.set(g.courseId, g);
      }
    }
    const grades = Array.from(uniqueMap.values());

    const courseIds = [...new Set(grades.map(g => g.courseId))];
    const courses = await this.courseRepository.createQueryBuilder('course')
      .where('course.id IN (:...courseIds)', { courseIds })
      .andWhere('course.organizationId = :organizationId', { organizationId })
      .select(['course.id', 'course.title', 'course.credits'])
      .getMany();

    let totalScore = 0;
    let totalCredits = 0;

    const populatedGrades = grades.map(grade => {
      const course = courses.find(c => c.id === grade.courseId);
      const credits = course?.credits || 0;
      totalScore += Number(grade.totalScore || 0);
      totalCredits += credits;
      return {
        ...grade,
        course: { title: course?.title || 'Unknown Course', credits }
      };
    });

    const averageScore = grades.length > 0 ? (totalScore / grades.length).toFixed(2) : 0;

    return {
      grades: populatedGrades,
      totalCredits,
      averageScore
    };
  }
}
