import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { OfflineGrade } from './entities/offline-grade.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';
import { Semester } from '../semesters/entities/semester.entity';

@Injectable()
export class ManualGradesService {
  constructor(
    @InjectRepository(OfflineGrade)
    private readonly offlineGradeRepository: Repository<OfflineGrade>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepository: Repository<AssessmentResult>,
  ) {}

  private calculateGradeLetter(totalScore: number): string {
    if (totalScore >= 80) return 'A+';
    if (totalScore >= 75) return 'A';
    if (totalScore >= 70) return 'A-';
    if (totalScore >= 65) return 'B+';
    if (totalScore >= 60) return 'B';
    if (totalScore >= 55) return 'B-';
    if (totalScore >= 50) return 'C+';
    if (totalScore >= 45) return 'C';
    if (totalScore >= 40) return 'C-';
    return 'F';
  }

  async getGradesForCourse(organizationId: string, batchId: string, semesterId: string | null, courseId: string) {
    // 1. Get enrollments for this course AND batch
    const whereEnrollment: any = { organizationId, courseId, status: In(['ACTIVE', 'COMPLETED']) };
    if (batchId === 'none') {
      whereEnrollment.batchId = IsNull();
    } else if (batchId && batchId !== 'all') {
      whereEnrollment.batchId = batchId;
    }

    const enrollments = await this.enrollmentRepository.find({
      where: whereEnrollment,
    });

    if (!enrollments.length) return [];

    const studentIds = enrollments.map(e => e.studentId);

    // 2. Get students
    const students = await this.userRepository.createQueryBuilder('user')
      .where('user.id IN (:...studentIds)', { studentIds })
      .andWhere('user.organizationId = :organizationId', { organizationId })
      .select(['user.id', 'user.fullName', 'user.email'])
      .getMany();

    // 3. Get existing offline grades — filtered by organizationId and courseId
    const existingGrades = await this.offlineGradeRepository.createQueryBuilder('grade')
      .where('grade.studentId IN (:...studentIds)', { studentIds })
      .andWhere('grade.organizationId = :organizationId', { organizationId })
      .andWhere('grade.courseId = :courseId', { courseId })
      .orderBy('grade.updatedAt', 'DESC')
      .getMany();

    // 4. Get In-Video Quiz Results (part of 65% CIA)
    let videoQuizMap: Record<string, { total: number; correct: number }> = {};
    try {
      const vqList = await this.enrollmentRepository.manager.createQueryBuilder()
        .select(['vqa.studentId as studentId', 'vqa.isCorrect as isCorrect', 'vqa.marks as marks'])
        .from('videoquizanswers', 'vqa')
        .innerJoin('lessons', 'l', 'l.id = vqa.lessonId')
        .where('vqa.studentId IN (:...studentIds)', { studentIds })
        .andWhere('vqa.organizationId = :organizationId', { organizationId })
        .andWhere('l.courseId = :courseId', { courseId })
        .getRawMany();

      for (const v of vqList) {
        if (!videoQuizMap[v.studentId]) videoQuizMap[v.studentId] = { total: 0, correct: 0 };
        videoQuizMap[v.studentId].total += 1;
        if (v.isCorrect) videoQuizMap[v.studentId].correct += 1;
      }
    } catch (e) {}

    // 5. Get Online Assessment Results (Non-Final Exams vs Final Exam)
    const onlineResults = await this.assessmentResultRepository.createQueryBuilder('result')
      .leftJoin('exams', 'exam', 'exam.id = result.examId')
      .where('result.studentId IN (:...studentIds)', { studentIds })
      .andWhere('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.courseId = :courseId', { courseId })
      .select([
        'result.studentId as studentId',
        'result.percentage as percentage',
        'exam.isFinalExam as isFinalExam',
      ])
      .getRawMany();

    const nonFinalExamMap: Record<string, { totalScorePct: number; count: number }> = {};
    const finalExamOnlineMap: Record<string, number> = {};

    for (const res of onlineResults) {
      if (res.isFinalExam) {
        finalExamOnlineMap[res.studentId] = Number(res.percentage) || 0;
      } else {
        if (!nonFinalExamMap[res.studentId]) nonFinalExamMap[res.studentId] = { totalScorePct: 0, count: 0 };
        nonFinalExamMap[res.studentId].totalScorePct += Number(res.percentage) || 0;
        nonFinalExamMap[res.studentId].count += 1;
      }
    }

    // 6. Get Semester Weightage (dynamic per-program/semester)
    let ciaWeight = 65; // Default: 65% CIA
    let attWeight = 5;  // Default: 5% Attendance
    let examWeight = 30; // Default: 30% Final Exam
    if (semesterId) {
      try {
        const semester = await this.enrollmentRepository.manager.getRepository(Semester).findOne({ where: { id: semesterId } });
        if (semester) {
          ciaWeight = semester.internalWeightage ?? 65;
          attWeight = semester.attendanceWeightage ?? 5;
          examWeight = semester.finalExamWeightage ?? 30;
        }
      } catch (e) {}
    }
    const ciaFraction = ciaWeight / 100; // e.g., 0.65 or 0.55
    const examFraction = examWeight / 100; // e.g., 0.30 or 0.40
    const maxCiaAtt = ciaWeight + attWeight; // e.g., 70 or 60

    // 7. Get Attendance Results (Weightage from Live Sessions)
    let attendanceScoreMap: Record<string, number> = {};
    try {
      const liveSessions = await this.enrollmentRepository.manager.createQueryBuilder()
        .select(['s.id as id', 's.attendeeStudentIds as attendeeStudentIds'])
        .from('subject_live_sessions', 's')
        .where('s.organizationId = :organizationId', { organizationId })
        .andWhere('(s.courseId = :courseId OR s.batchId = :batchId)', { courseId, batchId })
        .getRawMany();

      for (const sid of studentIds) {
        let attendedCount = 0;
        for (const ls of liveSessions) {
          try {
            const arr = Array.isArray(ls.attendeeStudentIds) ? ls.attendeeStudentIds : JSON.parse(ls.attendeeStudentIds || '[]');
            if (arr.includes(sid)) attendedCount += 1;
          } catch (err) {}
        }
        // Max 5 live calls = 5 marks
        attendanceScoreMap[sid] = Math.min(5, attendedCount);
      }
    } catch (e) {}

    // 8. Combine using dynamic weightage: CIA% + Attendance% + Final Exam%
    const results = enrollments.map(enrollment => {
      const student = students.find(s => s.id === enrollment.studentId);
      const grade = existingGrades.find(g => g.studentId === enrollment.studentId);

      let assignmentScoreCiaAtt = grade?.assignmentScore !== undefined && grade?.assignmentScore !== null ? Number(grade.assignmentScore) : null;

      // Auto-compute CIA + Attendance if not already manually saved
      if (assignmentScoreCiaAtt === null) {
        let internalPercentages: number[] = [];

        // In-video quizzes percentage
        const vq = videoQuizMap[enrollment.studentId];
        if (vq && vq.total > 0) {
          internalPercentages.push((vq.correct / vq.total) * 100);
        }

        // Non-final exams percentage
        const nfe = nonFinalExamMap[enrollment.studentId];
        if (nfe && nfe.count > 0) {
          internalPercentages.push(nfe.totalScorePct / nfe.count);
        }

        let ciaComponent = 0;
        if (internalPercentages.length > 0) {
          const avgCiaPct = internalPercentages.reduce((a, b) => a + b, 0) / internalPercentages.length;
          ciaComponent = (avgCiaPct * ciaFraction);
        }

        const attendanceComponent = attendanceScoreMap[enrollment.studentId] || 0;
        assignmentScoreCiaAtt = Math.min(maxCiaAtt, Math.round((ciaComponent + attendanceComponent) * 100) / 100);
      }

      let finalExamScoreWeighted = grade?.finalExamScore !== undefined && grade?.finalExamScore !== null 
        ? Number(grade.finalExamScore) 
        : (finalExamOnlineMap[enrollment.studentId] !== undefined ? Math.round((finalExamOnlineMap[enrollment.studentId] * examFraction) * 100) / 100 : 0);

      const totalScore = Math.min(100, Math.round((Number(assignmentScoreCiaAtt) + Number(finalExamScoreWeighted)) * 100) / 100);
      const gradeLetter = this.calculateGradeLetter(totalScore);

      let ciaScoreWeighted = grade?.assignmentScore !== undefined && grade?.assignmentScore !== null ? Number(grade.assignmentScore) : null;
      let attScoreWeighted = grade?.attendanceScore !== undefined && grade?.attendanceScore !== null ? Number(grade.attendanceScore) : null;

      if (ciaScoreWeighted === null) {
        let internalPercentages: number[] = [];
        const vq = videoQuizMap[enrollment.studentId];
        if (vq && vq.total > 0) internalPercentages.push((vq.correct / vq.total) * 100);
        const nfe = nonFinalExamMap[enrollment.studentId];
        if (nfe && nfe.count > 0) internalPercentages.push(nfe.totalScorePct / nfe.count);

        if (internalPercentages.length > 0) {
          const avgCiaPct = internalPercentages.reduce((a, b) => a + b, 0) / internalPercentages.length;
          ciaScoreWeighted = Math.min(ciaWeight, Math.round((avgCiaPct * ciaFraction) * 100) / 100);
        } else {
          ciaScoreWeighted = 0;
        }
      }

      if (attScoreWeighted === null) {
        attScoreWeighted = attendanceScoreMap[enrollment.studentId] !== undefined ? attendanceScoreMap[enrollment.studentId] : attWeight;
      }

      let finalScoreWeighted = grade?.finalExamScore !== undefined && grade?.finalExamScore !== null 
        ? Number(grade.finalExamScore) 
        : (finalExamOnlineMap[enrollment.studentId] !== undefined ? Math.round((finalExamOnlineMap[enrollment.studentId] * examFraction) * 100) / 100 : 0);

      const calculatedTotal = Math.min(100, Math.round((Number(ciaScoreWeighted) + Number(attScoreWeighted) + Number(finalScoreWeighted)) * 100) / 100);
      const calculatedGrade = this.calculateGradeLetter(calculatedTotal);

      return {
        studentId: enrollment.studentId,
        student: {
          firstName: student?.fullName || 'Unknown Student',
          lastName: '',
          email: student?.email || '',
        },
        assignmentScore: ciaScoreWeighted, // CIA% Internal Assessment
        attendanceScore: attScoreWeighted,  // Attendance%
        finalExamScore: finalScoreWeighted, // Final Exam%
        totalScore: calculatedTotal,
        grade: calculatedGrade,
        isGraded: !!grade,
        weightage: { cia: ciaWeight, attendance: attWeight, finalExam: examWeight },
      };
    });

    return results;
  }

  async bulkUpsert(gradesData: any[]) {
    const results = [];
    for (const data of gradesData) {
      const { studentId, courseId, semesterId, academicBatchId, assignmentScore, attendanceScore, finalExamScore, organizationId } = data;
      
      let score65 = Number(assignmentScore) || 0;
      let attScore5 = Number(attendanceScore) !== undefined && attendanceScore !== null ? Number(attendanceScore) : 0;
      let score30 = Number(finalExamScore) || 0;
      
      const totalScore = Math.min(100, Math.round((score65 + attScore5 + score30) * 100) / 100);
      const grade = this.calculateGradeLetter(totalScore);

      // Find all existing records for this student and course
      const existingList = await this.offlineGradeRepository.find({
        where: {
          studentId,
          courseId,
          ...(organizationId ? { organizationId } : {})
        },
        order: { updatedAt: 'DESC' }
      });

      const batchVal = academicBatchId === 'none' || !academicBatchId ? null : academicBatchId;
      const semVal = semesterId === 'all' || semesterId === 'none' || !semesterId ? null : semesterId;

      if (existingList.length > 0) {
        const [primary, ...duplicates] = existingList;
        primary.assignmentScore = score65;
        primary.attendanceScore = attScore5;
        primary.finalExamScore = score30;
        primary.totalScore = totalScore;
        primary.grade = grade;
        primary.academicBatchId = batchVal;
        primary.semesterId = semVal;
        if (organizationId) primary.organizationId = organizationId;
        results.push(await this.offlineGradeRepository.save(primary));

        // Clean up any duplicate records from past tests
        if (duplicates.length > 0) {
          await this.offlineGradeRepository.remove(duplicates);
        }
      } else {
        const newGrade = this.offlineGradeRepository.create({
          studentId,
          courseId,
          semesterId: semVal || undefined,
          academicBatchId: batchVal || undefined,
          organizationId,
          assignmentScore: score65,
          attendanceScore: attScore5,
          finalExamScore: score30,
          totalScore,
          grade,
        });
        results.push(await this.offlineGradeRepository.save(newGrade));
      }
    }
    return results;
  }
}
