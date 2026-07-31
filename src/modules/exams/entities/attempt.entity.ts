import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('attempts')
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  examId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  attemptNumber: number;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'IN_PROGRESS',
    enum: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'],
  })
  status: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date;

  @Column({ type: 'json', nullable: true })
  answers: any[];

  @Column({ type: 'int', nullable: true, default: 0 })
  marksObtained: number;

  @Column({ type: 'int' })
  totalMarks: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  percentage: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  isPassed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
