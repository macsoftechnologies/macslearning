import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lesson_ai_attempts')
@Index(['organizationId', 'studentId', 'lessonId'])
export class LessonAiAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'int', default: 5 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Column({ type: 'json', nullable: true })
  answers: any[];

  @Column({
    type: 'enum',
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'COMPLETED',
  })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
