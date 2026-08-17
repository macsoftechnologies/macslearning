import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('academic_batches')
export class AcademicBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar', nullable: true })
  programId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  degreeName: string;

  @Column({ type: 'int' })
  totalSemesters: number;

  @Column({ type: 'int', nullable: true })
  totalCreditsRequired: number;

  @Column({ type: 'json' })
  courseMappings: any;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'date', nullable: true })
  enrollmentOpenDate: Date;

  @Column({ type: 'date', nullable: true })
  enrollmentCloseDate: Date;

  @Column({ type: 'enum', enum: ['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'UPCOMING' })
  status: string;

  @Column({ type: 'int', nullable: true })
  maxStudents: number;

  @Column({ type: 'int', default: 0 })
  currentEnrolledCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
