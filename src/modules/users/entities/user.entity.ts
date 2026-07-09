import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  organizationId: string;

  @Column({ type: 'varchar', nullable: true })
  regionId: string;

  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  mobile: string;

  @Column({ type: 'varchar', select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: ['SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT', 'FINANCE'],
  })
  userType: string;

  @Column({ type: 'varchar', nullable: true })
  designation: string;

  @Column({ type: 'json', nullable: true })
  modulePermissions: string[];

  @Column({ type: 'json', nullable: true })
  assignedCourses: string[];

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'],
    default: 'ACTIVE',
  })
  status: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  emailVerifyToken: string;

  @Column({ type: 'varchar', nullable: true })
  passwordResetToken: string;

  @Column({ type: 'datetime', nullable: true })
  passwordResetExpires: Date;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lockUntil: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLogin: Date;

  @Column({ type: 'json', select: false, nullable: true })
  refreshTokens: any;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  rejectedBy: string;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
