import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lessoncheckpoints')
export class LessonCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  moduleId: string;

  @Column({ type: 'varchar' })
  questionText: string;

  @Column({ type: 'int' })
  timestampSeconds: number;

  @Column({ type: 'enum', enum: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'] })
  type: string;

  @Column({ type: 'json', nullable: true })
  options: any[];
  @Column({ type: 'boolean', nullable: true, default: true })
  required: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
