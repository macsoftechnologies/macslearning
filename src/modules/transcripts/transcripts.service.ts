import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import PDFDocument from 'pdfkit';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';
import { Semester } from '../semesters/entities/semester.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Program } from '../programs/entities/program.entity';
import { AcademicBatch } from './entities/academic-batch.entity';

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0,
  'A': 4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B': 3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C': 2.0,
  'C-': 1.7,
  'D': 1.0,
  'F': 0.0,
};

@Injectable()
export class TranscriptsService {
  constructor(
    @InjectRepository(OfflineGrade) private offlineGradeRepository: Repository<OfflineGrade>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Semester) private semesterRepository: Repository<Semester>,
    @InjectRepository(Enrollment) private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Program) private programRepository: Repository<Program>,
    @InjectRepository(AcademicBatch) private batchRepository: Repository<AcademicBatch>,
  ) {}

  async generatePdf(organizationId: string, studentId: string, conduct?: string, awards?: string): Promise<Buffer> {
    const student = await this.userRepository.findOne({ where: { id: studentId, organizationId, isDeleted: false } });
    if (!student) throw new NotFoundException('Student not found');

    // 1. Fetch Student Enrollments
    const enrollments = await this.enrollmentRepository.find({
      where: [
        { studentId, organizationId, status: 'ACTIVE' },
        { studentId, organizationId },
      ],
    });

    const programId = enrollments.find(e => e.programId)?.programId;
    const batchId = enrollments.find(e => e.batchId)?.batchId;

    let program: Program | null = null;
    let batch: AcademicBatch | null = null;

    if (programId) {
      program = await this.programRepository.findOne({ where: { id: programId, organizationId } });
    }
    if (batchId) {
      batch = await this.batchRepository.findOne({ where: { id: batchId, organizationId } });
    }

    // 2. Fetch All Semesters for this Program / Organization
    let semesters = await this.semesterRepository.find({
      where: programId ? { organizationId, programId } : { organizationId },
      order: { createdAt: 'ASC' },
    });

    if (semesters.length === 0) {
      semesters = await this.semesterRepository.find({
        where: { organizationId },
        order: { createdAt: 'ASC' },
      });
    }

    // 3. Fetch All Program Courses
    let allCourses = await this.courseRepository.find({
      where: programId ? { organizationId, programId, isDeleted: false } : { organizationId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });

    if (allCourses.length === 0) {
      allCourses = await this.courseRepository.find({
        where: { organizationId, isDeleted: false },
        order: { createdAt: 'ASC' },
      });
    }

    // 4. Fetch All Graded Records for Student
    const allGrades = await this.offlineGradeRepository.find({
      where: { studentId, organizationId },
      order: { updatedAt: 'DESC' }
    });

    const gradeMap = new Map<string, OfflineGrade>();
    for (const g of allGrades) {
      if (!gradeMap.has(g.courseId)) {
        gradeMap.set(g.courseId, g);
      }
    }

    // 5. Build Semester-Wise Structured Curriculum
    interface TranscriptRow {
      semesterName: string;
      courseName: string;
      creditEarned: number;
      marks: string;
      grade: string;
      points: string;
      isCompleted: boolean;
    }

    const rows: TranscriptRow[] = [];
    const assignedCourseIds = new Set<string>();

    if (semesters.length > 0) {
      for (const sem of semesters) {
        const semCourses = allCourses.filter(c => c.semesterId === sem.id);
        const semLabel = sem.name || sem.term || 'Semester';

        if (semCourses.length > 0) {
          for (const c of semCourses) {
            assignedCourseIds.add(c.id);
            const gr = gradeMap.get(c.id);
            const isCompleted = !!gr && Number(gr.totalScore) > 0;
            const pointsVal = isCompleted && gr.grade ? (GRADE_POINTS[gr.grade] !== undefined ? GRADE_POINTS[gr.grade].toFixed(1) : '3.0') : '';

            rows.push({
              semesterName: semLabel,
              courseName: c.title,
              creditEarned: Number(c.credits) || 3,
              marks: isCompleted ? String(gr.totalScore) : '',
              grade: isCompleted ? String(gr.grade || '') : '',
              points: pointsVal,
              isCompleted,
            });
          }
        }
      }
    }

    // Remaining courses not explicitly mapped to a semester
    const remainingCourses = allCourses.filter(c => !assignedCourseIds.has(c.id));
    if (remainingCourses.length > 0) {
      for (const c of remainingCourses) {
        const gr = gradeMap.get(c.id);
        const isCompleted = !!gr && Number(gr.totalScore) > 0;
        const pointsVal = isCompleted && gr.grade ? (GRADE_POINTS[gr.grade] !== undefined ? GRADE_POINTS[gr.grade].toFixed(1) : '3.0') : '';

        rows.push({
          semesterName: 'Electives / Core',
          courseName: c.title,
          creditEarned: Number(c.credits) || 3,
          marks: isCompleted ? String(gr.totalScore) : '',
          grade: isCompleted ? String(gr.grade || '') : '',
          points: pointsVal,
          isCompleted,
        });
      }
    }

    // Fallback: If no courses found from program, use grades directly
    if (rows.length === 0 && allGrades.length > 0) {
      for (const gr of allGrades) {
        const course = allCourses.find(c => c.id === gr.courseId);
        const pointsVal = gr.grade ? (GRADE_POINTS[gr.grade] !== undefined ? GRADE_POINTS[gr.grade].toFixed(1) : '3.0') : '';
        rows.push({
          semesterName: 'Core Semester',
          courseName: course?.title || 'Academic Subject',
          creditEarned: Number(course?.credits) || 3,
          marks: String(gr.totalScore),
          grade: String(gr.grade || ''),
          points: pointsVal,
          isCompleted: true,
        });
      }
    }

    // 6. Calculate Totals
    let totalCredits = 0;
    let totalMarks = 0;
    let totalPoints = 0;
    let completedCount = 0;

    for (const r of rows) {
      if (r.isCompleted) {
        totalCredits += r.creditEarned;
        totalMarks += Number(r.marks) || 0;
        totalPoints += Number(r.points) || 0;
        completedCount++;
      } else {
        totalCredits += r.creditEarned;
      }
    }

    const gpa = completedCount > 0 ? (totalPoints / completedCount).toFixed(1) : '';
    const avgScore = completedCount > 0 ? (totalMarks / completedCount).toFixed(1) : '';

    // 7. Render PDF Document
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 36 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header Section
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b').text('GLOBAL ONLINE – ATA ACCREDITED', { align: 'center' });
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#334155').text('COTR Theological Seminary', { align: 'center' });
        doc.fontSize(11).font('Helvetica').fillColor('#64748b').text('Official Academic Record & Transcript', { align: 'center' });
        doc.moveDown(0.7);

        // Student Info Box
        const startY = doc.y;
        doc.rect(36, startY, 523, 50).fillAndStroke('#f8fafc', '#cbd5e1');

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
        doc.text(`Student Name:`, 46, startY + 8);
        doc.font('Helvetica').text(student.fullName || 'Student', 125, startY + 8);

        doc.font('Helvetica-Bold').text(`Student ID / Reg:`, 330, startY + 8);
        doc.font('Helvetica').text(student.registrationId || studentId.substring(0, 18), 425, startY + 8);

        doc.font('Helvetica-Bold').text(`Program:`, 46, startY + 22);
        doc.font('Helvetica').text(program?.name || 'Theological Degree', 125, startY + 22);

        doc.font('Helvetica-Bold').text(`Batch / Cohort:`, 330, startY + 22);
        doc.font('Helvetica').text(batch?.name || 'Academic Batch', 425, startY + 22);

        doc.font('Helvetica-Bold').text(`Date Issued:`, 46, startY + 36);
        doc.font('Helvetica').text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 125, startY + 36);

        doc.font('Helvetica-Bold').text(`Conduct:`, 330, startY + 36);
        doc.font('Helvetica').text(conduct || 'Satisfactory', 425, startY + 36);

        doc.y = startY + 60;

        // Table Header
        const tableX = 36;
        let curY = doc.y;
        const colW = { sem: 105, course: 220, credits: 55, marks: 45, grade: 45, points: 53 };

        doc.rect(tableX, curY, 523, 20).fillAndStroke('#e2e8f0', '#94a3b8');
        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');

        doc.text('Semester', tableX + 6, curY + 6, { width: colW.sem });
        doc.text('Course Name', tableX + colW.sem + 6, curY + 6, { width: colW.course });
        doc.text('Credit Earned', tableX + colW.sem + colW.course, curY + 6, { width: colW.credits, align: 'center' });
        doc.text('Marks', tableX + colW.sem + colW.course + colW.credits, curY + 6, { width: colW.marks, align: 'center' });
        doc.text('Grade', tableX + colW.sem + colW.course + colW.credits + colW.marks, curY + 6, { width: colW.grade, align: 'center' });
        doc.text('Points', tableX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY + 6, { width: colW.points, align: 'center' });

        curY += 20;

        // Group rows by semester for clean vertical grouping
        let lastSemester = '';
        const rowHeight = 17;

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];

          // Check for page break
          if (curY + rowHeight > 750) {
            doc.addPage();
            curY = 36;
            // Redraw Header
            doc.rect(tableX, curY, 523, 20).fillAndStroke('#e2e8f0', '#94a3b8');
            doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
            doc.text('Semester', tableX + 6, curY + 6, { width: colW.sem });
            doc.text('Course Name', tableX + colW.sem + 6, curY + 6, { width: colW.course });
            doc.text('Credit Earned', tableX + colW.sem + colW.course, curY + 6, { width: colW.credits, align: 'center' });
            doc.text('Marks', tableX + colW.sem + colW.course + colW.credits, curY + 6, { width: colW.marks, align: 'center' });
            doc.text('Grade', tableX + colW.sem + colW.course + colW.credits + colW.marks, curY + 6, { width: colW.grade, align: 'center' });
            doc.text('Points', tableX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY + 6, { width: colW.points, align: 'center' });
            curY += 20;
          }

          const showSem = r.semesterName !== lastSemester;
          lastSemester = r.semesterName;

          doc.rect(tableX, curY, 523, rowHeight).stroke('#cbd5e1');

          // Vertical Column Dividers
          let dividerX = tableX;
          doc.moveTo(dividerX + colW.sem, curY).lineTo(dividerX + colW.sem, curY + rowHeight).stroke('#cbd5e1');
          doc.moveTo(dividerX + colW.sem + colW.course, curY).lineTo(dividerX + colW.sem + colW.course, curY + rowHeight).stroke('#cbd5e1');
          doc.moveTo(dividerX + colW.sem + colW.course + colW.credits, curY).lineTo(dividerX + colW.sem + colW.course + colW.credits, curY + rowHeight).stroke('#cbd5e1');
          doc.moveTo(dividerX + colW.sem + colW.course + colW.credits + colW.marks, curY).lineTo(dividerX + colW.sem + colW.course + colW.credits + colW.marks, curY + rowHeight).stroke('#cbd5e1');
          doc.moveTo(dividerX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY).lineTo(dividerX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY + rowHeight).stroke('#cbd5e1');

          doc.fillColor('#0f172a').fontSize(8);

          if (showSem) {
            doc.font('Helvetica-Bold').text(r.semesterName, tableX + 6, curY + 4, { width: colW.sem - 10, lineBreak: false });
          }

          doc.font('Helvetica').text(r.courseName, tableX + colW.sem + 6, curY + 4, { width: colW.course - 10, lineBreak: false });
          doc.text(String(r.creditEarned), tableX + colW.sem + colW.course, curY + 4, { width: colW.credits, align: 'center' });
          
          // Marks, Grade, Points (blank if not completed)
          doc.font('Helvetica-Bold');
          doc.text(r.marks, tableX + colW.sem + colW.course + colW.credits, curY + 4, { width: colW.marks, align: 'center' });
          doc.text(r.grade, tableX + colW.sem + colW.course + colW.credits + colW.marks, curY + 4, { width: colW.grade, align: 'center' });
          doc.text(r.points, tableX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY + 4, { width: colW.points, align: 'center' });

          curY += rowHeight;
        }

        // Summary Total Row
        doc.rect(tableX, curY, 523, 20).fillAndStroke('#f1f5f9', '#94a3b8');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');

        doc.text('Total', tableX + 6, curY + 5, { width: colW.sem });
        doc.text(String(totalCredits), tableX + colW.sem + colW.course, curY + 5, { width: colW.credits, align: 'center' });
        doc.text(completedCount > 0 ? String(totalMarks) : '', tableX + colW.sem + colW.course + colW.credits, curY + 5, { width: colW.marks, align: 'center' });
        doc.text(completedCount > 0 ? `Avg: ${avgScore}` : '', tableX + colW.sem + colW.course + colW.credits + colW.marks, curY + 5, { width: colW.grade, align: 'center' });
        doc.text(gpa ? `GPA: ${gpa}` : '', tableX + colW.sem + colW.course + colW.credits + colW.marks + colW.grade, curY + 5, { width: colW.points, align: 'center' });

        curY += 35;

        // Signature & Seal Block
        if (curY + 50 > 750) {
          doc.addPage();
          curY = 50;
        }

        doc.fontSize(8.5).font('Helvetica');
        doc.text('_____________________________', 46, curY + 25);
        doc.font('Helvetica-Bold').text('Registrar / Academic Dean', 46, curY + 38);

        doc.font('Helvetica').text('_____________________________', 370, curY + 25);
        doc.font('Helvetica-Bold').text('President / Principal', 370, curY + 38);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async getMyGrades(organizationId: string, studentId: string) {
    const allGrades = await this.offlineGradeRepository.find({
      where: { studentId, organizationId },
      order: { updatedAt: 'DESC' }
    });
    if (allGrades.length === 0) return { grades: [], totalCredits: 0, averageScore: 0 };

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
