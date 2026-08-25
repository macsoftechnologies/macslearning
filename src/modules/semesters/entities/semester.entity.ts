import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('semesters')
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  name: string; // e.g., "First Semester 2026", "Second Semester 2026"

  @Column({ type: 'varchar' })
  term: string; // e.g. "First", "Second"

  @Column({ type: 'varchar', nullable: true })
  programId: string; // relation to program

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 70 })
  passingPercentage: number;

  @Column({ type: 'int', default: 55 })
  internalWeightage: number;

  @Column({ type: 'int', default: 5 })
  attendanceWeightage: number;

  @Column({ type: 'int', default: 40 })
  finalExamWeightage: number;

  @Column({ type: 'int', default: 5 })
  totalSubjects: number;

  @Column({ type: 'int', default: 25 })
  requiredInteractions: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
