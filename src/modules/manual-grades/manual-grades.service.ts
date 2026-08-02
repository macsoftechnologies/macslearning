import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfflineGrade } from './entities/offline-grade.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ManualGradesService {
  constructor(
    @InjectRepository(OfflineGrade)
    private readonly offlineGradeRepository: Repository<OfflineGrade>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getGradesForCourse(organizationId: string, batchId: string, semesterId: string, courseId: string) {
    // 1. Get enrollments for this course AND batch
    const enrollments = await this.enrollmentRepository.find({
      where: { organizationId, batchId, courseId, status: 'ACTIVE' },
    });

    if (!enrollments.length) return [];

    const studentIds = enrollments.map(e => e.studentId);

    // 2. Get students
    const students = await this.userRepository.createQueryBuilder('user')
      .where('user.id IN (:...studentIds)', { studentIds })
      .select(['user.id', 'user.fullName', 'user.email'])
      .getMany();

    // 3. Get existing offline grades
    const existingGrades = await this.offlineGradeRepository.createQueryBuilder('grade')
      .where('grade.studentId IN (:...studentIds)', { studentIds })
      .andWhere('grade.academicBatchId = :batchId', { batchId })
      .andWhere('grade.semesterId = :semesterId', { semesterId })
      .andWhere('grade.courseId = :courseId', { courseId })
      .getMany();

    // 4. Combine
    const results = enrollments.map(enrollment => {
      const student = students.find(s => s.id === enrollment.studentId);
      const grade = existingGrades.find(g => g.studentId === enrollment.studentId);

      return {
        studentId: enrollment.studentId,
        student: {
          firstName: student?.fullName || 'Unknown Student',
          lastName: '',
          email: student?.email || '',
        },
        assignmentScore: grade?.assignmentScore || 0,
        finalExamScore: grade?.finalExamScore || 0,
        totalScore: grade?.totalScore || 0,
        grade: grade?.grade || 'F',
      };
    });

    return results;
  }

  async bulkUpsert(gradesData: any[]) {
    const results = [];
    for (const data of gradesData) {
      const { studentId, courseId, semesterId, academicBatchId, assignmentScore, finalExamScore } = data;
      const totalScore = Number(assignmentScore) + Number(finalExamScore);

      // Determine grade based on image provided (simplified for now)
      let grade = 'F';
      if (totalScore >= 80) grade = 'A+';
      else if (totalScore >= 75) grade = 'A';
      else if (totalScore >= 70) grade = 'A-';
      else if (totalScore >= 65) grade = 'B+';
      else if (totalScore >= 60) grade = 'B';
      else if (totalScore >= 55) grade = 'B-';
      else if (totalScore >= 50) grade = 'C+';
      else if (totalScore >= 45) grade = 'C';
      else if (totalScore >= 40) grade = 'C-';

      let existing = await this.offlineGradeRepository.findOne({
        where: { studentId, courseId, semesterId, academicBatchId },
      });

      if (existing) {
        existing.assignmentScore = assignmentScore;
        existing.finalExamScore = finalExamScore;
        existing.totalScore = totalScore;
        existing.grade = grade;
        results.push(await this.offlineGradeRepository.save(existing));
      } else {
        const newGrade = this.offlineGradeRepository.create({
          studentId,
          courseId,
          semesterId,
          academicBatchId,
          assignmentScore,
          finalExamScore,
          totalScore,
          grade,
        });
        results.push(await this.offlineGradeRepository.save(newGrade));
      }
    }
    return results;
  }
}
