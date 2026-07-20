import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ type: 'int' })
  passingPercentage: number;

  @Column({ type: 'int' })
  totalMarks: number;

  @Column({ type: 'int', nullable: true, default: 3 })
  maxAttempts: number;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'DRAFT',
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  status: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isFinalExam: boolean;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
