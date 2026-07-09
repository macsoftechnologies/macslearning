import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('assessmentresults')
export class AssessmentResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  examId: string;

  @Column({ type: 'varchar' })
  attemptId: string;

  @Column({ type: 'int' })
  marksObtained: number;

  @Column({ type: 'int' })
  totalMarks: number;

  @Column({ type: 'int' })
  percentage: number;

  @Column({ type: 'boolean' })
  isPassed: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  isPublished: boolean;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  gradedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
