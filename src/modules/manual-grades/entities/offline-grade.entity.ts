import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('offline_grades')
export class OfflineGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar', nullable: true })
  semesterId: string;

  @Column({ type: 'varchar', nullable: true })
  academicBatchId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  assignmentScore: number; // Max 70

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  finalExamScore: number; // Max 30

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  totalScore: number; // Max 100

  @Column({ type: 'varchar', nullable: true })
  grade: string; // e.g., A+, A, B, etc.

  @Column({ type: 'varchar', nullable: true })
  gradedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
