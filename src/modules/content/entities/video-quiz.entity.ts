import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('videoquizs')
export class VideoQuiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'int' })
  timestampSeconds: number;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'MCQ',
    enum: ['MCQ', 'TRUE_FALSE', 'THEORY'],
  })
  type: string;

  @Column({ type: 'varchar' })
  questionText: string;

  @Column({ type: 'json', nullable: true })
  options: any[];
  @Column({ type: 'varchar', nullable: true })
  correctAnswer: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  maxMarks: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
