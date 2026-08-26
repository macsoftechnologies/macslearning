import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('student_cyclic_progress')
@Index(['organizationId', 'studentId', 'programId'])
export class StudentCyclicProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  programId: string;

  @Column({ type: 'varchar', nullable: true })
  batchId: string;

  @Column({ type: 'int', default: 1 })
  currentCycleRound: number; // 1 = First Cycle (Sem 1-6), 2 = Second Cycle (Backlog Clearance)

  @Column({ type: 'int', default: 1 })
  currentSemesterNumber: number; // 1, 2, 3, 4, 5, 6

  @Column({ type: 'varchar', nullable: true })
  currentSemesterId: string;

  @Column({ type: 'longtext', nullable: true })
  passedCourseIds: string; // JSON array of passed course IDs

  @Column({ type: 'longtext', nullable: true })
  backlogCourseIds: string; // JSON array of failed course IDs

  @Column({
    type: 'enum',
    enum: ['IN_PROGRESS', 'CYCLE_REPEAT', 'ADMIN_REVIEW_REQUIRED', 'COMPLETED'],
    default: 'IN_PROGRESS',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
