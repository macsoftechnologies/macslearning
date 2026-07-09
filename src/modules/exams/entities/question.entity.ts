import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  examId: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  questionText: string;

  @Column({ type: 'varchar', nullable: true })
  videoUrl: string;

  @Column({ type: 'enum', enum: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'] })
  type: string;

  @Column({ type: 'json', nullable: true })
  options: any[];
  @Column({ type: 'varchar', nullable: true })
  correctAnswer: string;

  @Column({ type: 'int' })
  marks: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  orderIndex: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
