import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  regionId: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', nullable: true })
  domain: string;

  @Column({ type: 'json', nullable: true })
  themeColors: any;

  @Column({ type: 'json', nullable: true })
  contactInfo: any;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  loginUrl: string;

  @Column({ type: 'json', nullable: true })
  subscriptionConfig: any;

  /*
  @Column({
    type: 'enum',
    enum: ['PAID', 'PENDING', 'OVERDUE'],
    default: 'PENDING',
  })
  paymentStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentDate: Date;

  @Column({ type: 'varchar', nullable: true })
  paymentReferenceId: string;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string;
  */

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
