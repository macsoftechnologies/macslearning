import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lessonprogresss')
export class LessonProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  moduleId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isCompleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true, default: 0 })
  watchedSeconds: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastAccessedAt: Date;

  @Column({ type: 'json', nullable: true })
  checkpointPassedIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
