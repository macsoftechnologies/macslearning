import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfflineGrade } from './entities/offline-grade.entity';

@Injectable()
export class ManualGradesService {
  constructor(
    @InjectRepository(OfflineGrade)
    private readonly offlineGradeRepository: Repository<OfflineGrade>,
  ) {}

  async bulkUpsert(gradesData: any[]) {
    const results = [];
    for (const data of gradesData) {
      const { studentId, courseId, semesterId, assignmentScore, finalExamScore } = data;
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
        where: { studentId, courseId, semesterId },
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
