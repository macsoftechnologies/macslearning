import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lessoncheckpointanswers')
export class LessonCheckpointAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  checkpointId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar', nullable: true })
  selectedOption: string;

  @Column({ type: 'varchar', nullable: true })
  textAnswer: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isGraded: boolean;

  @Column({ type: 'int', nullable: true, default: 0 })
  marks: number;

  @Column({ type: 'varchar', nullable: true })
  gradedBy: string;

  @Column({ type: 'datetime', nullable: true })
  gradedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
