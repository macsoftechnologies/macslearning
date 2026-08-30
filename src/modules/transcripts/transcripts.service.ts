import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

function getPoints(gradeLetter: string, score: number): string {
  if (gradeLetter && GRADE_POINTS[gradeLetter] !== undefined) {
    return GRADE_POINTS[gradeLetter].toFixed(1);
  }
  if (score >= 80) return '4.0';
  if (score >= 75) return '4.0';
  if (score >= 70) return '3.7';
  if (score >= 65) return '3.3';
  if (score >= 60) return '3.0';
  if (score >= 55) return '2.7';
  if (score >= 50) return '2.3';
  if (score >= 45) return '2.0';
  if (score >= 40) return '1.7';
  return '0.0';
}

const SEMESTER_NAMES = [
  'First Semester',
  'Second Semester',
  'Third Semester',
  'Fourth Semester',
  'Fifth Semester',
  'Sixth Semester',
  'Seventh Semester',
  'Eighth Semester',
];

// Standard subject chunking per semester (5, 4, 4, 4, 4, 4, 5 for 30 subjects)
const SEMESTER_CHUNK_SIZES = [5, 4, 4, 4, 4, 4, 5];

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

    const programId = student.programId || enrollments.find(e => e.programId)?.programId;

    // 2. Fetch All Semesters for this Program / Organization
    let dbSemesters = await this.semesterRepository.find({
      where: programId ? { organizationId, programId } : { organizationId },
      order: { createdAt: 'ASC' },
    });

    if (dbSemesters.length === 0) {
      dbSemesters = await this.semesterRepository.find({
        where: { organizationId },
        order: { createdAt: 'ASC' },
      });
    }

    // 3. Fetch All Curriculum Courses
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

    // 5. Structure courses evenly by Semesters (First Semester, Second Semester, etc.)
    interface CourseRow {
      title: string;
      credits: number;
      marks: string;
      grade: string;
      points: string;
      isCompleted: boolean;
    }

    interface SemesterGroup {
      name: string;
      courses: CourseRow[];
    }

    const semesterGroups: SemesterGroup[] = [];

    // Check if courses already have explicit semesterId
    const hasExplicitSemesters = allCourses.some(c => c.semesterId && dbSemesters.some(s => s.id === c.semesterId));

    if (hasExplicitSemesters) {
      for (const sem of dbSemesters) {
        const semLabel = sem.name || sem.term || 'Semester';
        const matched = allCourses.filter(c => c.semesterId === sem.id);
        if (matched.length > 0) {
          semesterGroups.push({
            name: semLabel,
            courses: matched.map(c => {
              const gr = gradeMap.get(c.id);
              const isCompleted = !!gr && Number(gr.totalScore) > 0;
              return {
                title: c.title,
                credits: Number(c.credits) || 3,
                marks: isCompleted ? String(Math.round(Number(gr.totalScore))) : '',
                grade: isCompleted ? String(gr.grade || '') : '',
                points: isCompleted ? getPoints(gr.grade, Number(gr.totalScore)) : '',
                isCompleted,
              };
            }),
          });
        }
      }
    } else {
      // Divide curriculum courses cleanly across standard ATA Semesters (5, 4, 4, 4, 4, 4, 5)
      let courseIndex = 0;
      for (let s = 0; s < SEMESTER_NAMES.length && courseIndex < allCourses.length; s++) {
        const semName = SEMESTER_NAMES[s];
        const chunkSize = SEMESTER_CHUNK_SIZES[s] || 4;
        const chunk = allCourses.slice(courseIndex, courseIndex + chunkSize);
        courseIndex += chunkSize;

        if (chunk.length > 0) {
          semesterGroups.push({
            name: semName,
            courses: chunk.map(c => {
              const gr = gradeMap.get(c.id);
              const isCompleted = !!gr && Number(gr.totalScore) > 0;
              return {
                title: c.title,
                credits: Number(c.credits) || 3,
                marks: isCompleted ? String(Math.round(Number(gr.totalScore))) : '',
                grade: isCompleted ? String(gr.grade || '') : '',
                points: isCompleted ? getPoints(gr.grade, Number(gr.totalScore)) : '',
                isCompleted,
              };
            }),
          });
        }
      }
    }

    // 6. Compute Totals
    let totalCredits = 0;
    let totalMarks = 0;
    let totalPoints = 0;
    let completedCount = 0;

    for (const g of semesterGroups) {
      for (const c of g.courses) {
        totalCredits += c.credits;
        if (c.isCompleted) {
          totalMarks += Number(c.marks) || 0;
          totalPoints += Number(c.points) || 0;
          completedCount++;
        }
      }
    }

    const avgMarks = completedCount > 0 ? (totalMarks / completedCount).toFixed(1) : '';

    // 7. Render Exact Sample Table via PDFKit
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          info: { Title: 'Official Academic Transcript' }
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const startX = 20;
        let startY = 24;

        // Top Metadata: Student Name and Reg. Number
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
        doc.text(`Student Name : ${student.fullName || 'Student'}`, startX + 2, startY);
        const regDisplay = student.registrationId || (student.customProfile as any)?.registrationId || (student.customProfile as any)?.registrationNumber || '—';
        doc.text(`Reg. Number   : ${regDisplay}`, startX + 340, startY);

        startY += 20;

        const colW = {
          semester: 115,
          course: 220,
          credits: 80,
          marks: 45,
          grade: 45,
          points: 50,
        };
        const totalW = colW.semester + colW.course + colW.credits + colW.marks + colW.grade + colW.points; // 555 pt

        // Function to draw Table Header
        const drawTableHeader = (y: number) => {
          const headerH = 20;
          doc.lineWidth(0.75);
          doc.rect(startX, y, totalW, headerH).stroke('#000000');

          let curX = startX;
          [colW.semester, colW.course, colW.credits, colW.marks, colW.grade].forEach(w => {
            curX += w;
            doc.moveTo(curX, y).lineTo(curX, y + headerH).stroke('#000000');
          });

          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
          doc.text('Semester', startX, y + 5, { width: colW.semester, align: 'center' });
          doc.text('Course Name', startX + colW.semester, y + 5, { width: colW.course, align: 'center' });
          doc.text('Credit Earned', startX + colW.semester + colW.course, y + 5, { width: colW.credits, align: 'center' });
          doc.text('Marks', startX + colW.semester + colW.course + colW.credits, y + 5, { width: colW.marks, align: 'center' });
          doc.text('Grade', startX + colW.semester + colW.course + colW.credits + colW.marks, y + 5, { width: colW.grade, align: 'center' });
          doc.text('Points', startX + colW.semester + colW.course + colW.credits + colW.marks + colW.grade, y + 5, { width: colW.points, align: 'center' });

          return y + headerH;
        };

        startY = drawTableHeader(startY);
        const rowHeight = 17;

        for (const semGroup of semesterGroups) {
          const groupCount = semGroup.courses.length;
          const groupHeight = groupCount * rowHeight;

          // Page break check
          if (startY + groupHeight > 800) {
            doc.addPage();
            startY = drawTableHeader(24);
          }

          const semBlockTop = startY;

          // 1. Draw outer semester rectangle
          doc.lineWidth(0.75);
          doc.rect(startX, semBlockTop, colW.semester, groupHeight).stroke('#000000');

          // Centered Semester Label
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
          const semTextY = semBlockTop + (groupHeight / 2) - 5;
          doc.text(semGroup.name, startX + 4, semTextY, { width: colW.semester - 8, align: 'center' });

          // 2. Draw each course row inside this semester
          for (let i = 0; i < semGroup.courses.length; i++) {
            const c = semGroup.courses[i];
            const rowY = semBlockTop + (i * rowHeight);

            // Draw full row box starting from Course column
            const rightStartX = startX + colW.semester;
            const rightWidth = totalW - colW.semester;
            doc.rect(rightStartX, rowY, rightWidth, rowHeight).stroke('#000000');

            // Draw vertical column dividers for course, credits, marks, grade
            let curX = rightStartX;
            [colW.course, colW.credits, colW.marks, colW.grade].forEach(w => {
              curX += w;
              doc.moveTo(curX, rowY).lineTo(curX, rowY + rowHeight).stroke('#000000');
            });

            // Text Content
            doc.font('Helvetica').fontSize(8).fillColor('#000000');
            doc.text(c.title, rightStartX + 6, rowY + 4.5, { width: colW.course - 12, lineBreak: false });
            doc.text(String(c.credits), rightStartX + colW.course, rowY + 4.5, { width: colW.credits, align: 'center' });
            doc.text(c.marks, rightStartX + colW.course + colW.credits, rowY + 4.5, { width: colW.marks, align: 'center' });
            doc.text(c.grade, rightStartX + colW.course + colW.credits + colW.marks, rowY + 4.5, { width: colW.grade, align: 'center' });
            doc.text(c.points, rightStartX + colW.course + colW.credits + colW.marks + colW.grade, rowY + 4.5, { width: colW.points, align: 'center' });
          }

          startY += groupHeight;
        }

        // Total Row at the bottom
        const totalRowHeight = 20;
        if (startY + totalRowHeight > 800) {
          doc.addPage();
          startY = drawTableHeader(24);
        }

        doc.lineWidth(0.75);
        doc.rect(startX, startY, totalW, totalRowHeight).stroke('#000000');

        let curX = startX + colW.semester + colW.course;
        doc.moveTo(curX, startY).lineTo(curX, startY + totalRowHeight).stroke('#000000');

        [colW.credits, colW.marks, colW.grade].forEach(w => {
          curX += w;
          doc.moveTo(curX, startY).lineTo(curX, startY + totalRowHeight).stroke('#000000');
        });

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
        doc.text('Total', startX + 8, startY + 5, { width: colW.semester + colW.course - 16 });
        doc.text(String(totalCredits), startX + colW.semester + colW.course, startY + 5, { width: colW.credits, align: 'center' });
        doc.text(completedCount > 0 ? String(totalMarks) : '', startX + colW.semester + colW.course + colW.credits, startY + 5, { width: colW.marks, align: 'center' });
        doc.text(completedCount > 0 ? String(avgMarks) : '', startX + colW.semester + colW.course + colW.credits + colW.marks + colW.grade, startY + 5, { width: colW.points, align: 'center' });

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
