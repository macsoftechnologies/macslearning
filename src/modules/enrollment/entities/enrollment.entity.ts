import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  courseId: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
