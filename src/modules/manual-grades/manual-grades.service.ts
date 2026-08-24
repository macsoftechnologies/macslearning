import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { OfflineGrade } from './entities/offline-grade.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

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

    // 4. Get online assessment results (70% component)
    const onlineResults = await this.assessmentResultRepository.createQueryBuilder('result')
      .where('result.studentId IN (:...studentIds)', { studentIds })
      .andWhere('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.courseId = :courseId', { courseId })
      .getMany();

    // Group online scores by studentId
    const onlineScoreMap: Record<string, number> = {};
    const onlineCountMap: Record<string, number> = {};
    for (const res of onlineResults) {
      onlineScoreMap[res.studentId] = (onlineScoreMap[res.studentId] || 0) + (res.percentage || 0);
      onlineCountMap[res.studentId] = (onlineCountMap[res.studentId] || 0) + 1;
    }

    // 5. Combine with 70% online + 30% manual formula
    const results = enrollments.map(enrollment => {
      const student = students.find(s => s.id === enrollment.studentId);
      const grade = existingGrades.find(g => g.studentId === enrollment.studentId);

      let assignmentScore70 = grade?.assignmentScore !== undefined && grade?.assignmentScore !== null ? Number(grade.assignmentScore) : 0;
      // If no manually saved assignment score exists and student has taken online exams, compute 70% portion
      if (!assignmentScore70 && onlineCountMap[enrollment.studentId] > 0) {
        const avgPercentage = onlineScoreMap[enrollment.studentId] / onlineCountMap[enrollment.studentId];
        assignmentScore70 = Math.round((avgPercentage * 0.70) * 100) / 100;
      }

      const finalExamScore30 = grade?.finalExamScore !== undefined && grade?.finalExamScore !== null ? Number(grade.finalExamScore) : 0;
      const totalScore = Math.min(100, Math.round((assignmentScore70 + Number(finalExamScore30)) * 100) / 100);
      const gradeLetter = this.calculateGradeLetter(totalScore);

      return {
        studentId: enrollment.studentId,
        student: {
          firstName: student?.fullName || 'Unknown Student',
          lastName: '',
          email: student?.email || '',
        },
        assignmentScore: assignmentScore70, // 70% component
        finalExamScore: finalExamScore30,  // 30% manual component
        totalScore,
        grade: gradeLetter,
        isGraded: !!grade,
      };
    });

    return results;
  }

  async bulkUpsert(gradesData: any[]) {
    const results = [];
    for (const data of gradesData) {
      const { studentId, courseId, semesterId, academicBatchId, assignmentScore, finalExamScore, organizationId } = data;
      
      let score70 = Number(assignmentScore) || 0;
      
      // If assignmentScore wasn't provided directly and student has online exams, calculate 70%
      if ((assignmentScore === undefined || assignmentScore === null) && studentId && courseId) {
        const onlineResults = await this.assessmentResultRepository.find({
          where: { studentId, courseId, organizationId }
        });
        if (onlineResults.length > 0) {
          const totalPct = onlineResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
          const avgPct = totalPct / onlineResults.length;
          score70 = Math.round((avgPct * 0.70) * 100) / 100;
        }
      }

      const score30 = Number(finalExamScore) || 0;
      const totalScore = Math.min(100, Math.round((score70 + score30) * 100) / 100);
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
        primary.assignmentScore = score70;
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
          assignmentScore: score70,
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
