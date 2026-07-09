import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
export class Payment {
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
    default: 'COURSE_PURCHASE',
    enum: ['COURSE_PURCHASE'],
  })
  paymentType: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'COMPLETED',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'],
  })
  status: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', nullable: true, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', unique: true })
  dummyPaymentId: string;

  @Column({ type: 'boolean', nullable: true, default: true })
  isPaid: boolean;

  @Column({ type: 'varchar', nullable: true })
  enrollmentId: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'PENDING',
    enum: ['PENDING', 'GENERATED', 'FAILED'],
  })
  invoiceGenerationStatus: string;

  @Column({ type: 'varchar', nullable: true })
  invoicePath: string;

  @Column({ type: 'datetime', nullable: true })
  invoiceGeneratedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
