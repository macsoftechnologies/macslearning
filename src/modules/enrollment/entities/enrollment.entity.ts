import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AcademicBatch } from '../../transcripts/entities/academic-batch.entity';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'studentId' })
  student: User;

  @Column({ type: 'varchar', nullable: true })
  courseId: string;

  @Column({ type: 'varchar', nullable: true })
  semesterId: string;

  @Column({ type: 'varchar', nullable: true })
  programId: string;

  @Column({ type: 'varchar', nullable: true })
  batchId: string;

  @ManyToOne(() => AcademicBatch)
  @JoinColumn({ name: 'batchId' })
  batch: AcademicBatch;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'COMPLETED'],
  })
  status: string;

  @Column({ type: 'enum', enum: ['PAID', 'NOT_APPLICABLE', 'PENDING'] })
  paymentStatus: string;

  @Column({ type: 'enum', enum: ['SELF_ENROLL', 'ADMIN_ENROLL'] })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  paymentId: string;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'date', nullable: true })
  expectedGraduationDate: Date;

  @Column({ type: 'enum', enum: ['PAID_IN_FULL', 'PAY_PER_COURSE'], nullable: true })
  paymentModel: string;

  @Column({ type: 'int', default: 1, nullable: true })
  currentSemesterIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

