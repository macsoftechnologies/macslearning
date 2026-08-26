import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('dmin_evaluations')
@Index(['organizationId', 'studentId', 'programId'])
export class DMinEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  programId: string;

  @Column({ type: 'varchar', nullable: true })
  courseId: string;

  @Column({ type: 'varchar' })
  modularTitle: string;

  @Column({ type: 'varchar', length: 500 })
  documentUrl: string;

  @Column({ type: 'varchar', nullable: true })
  documentName: string;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number;

  @CreateDateColumn()
  submittedAt: Date;

  @Column({
    type: 'enum',
    enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED'],
    default: 'SUBMITTED',
  })
  status: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  marksObtained: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100.0 })
  totalMarks: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  grade: string;

  @Column({ type: 'text', nullable: true })
  facultyFeedback: string;

  @Column({ type: 'text', nullable: true })
  adminFeedback: string;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
