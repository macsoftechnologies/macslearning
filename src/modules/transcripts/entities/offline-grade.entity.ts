import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('offline_grades')
export class OfflineGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar', nullable: true })
  academicBatchId: string;

  @Column({ type: 'int', nullable: true })
  assignmentMarks: number;

  @Column({ type: 'int', nullable: true })
  finalExamMarks: number;

  @Column({ type: 'int' })
  totalMarks: number;

  @Column({ type: 'varchar' })
  gradeLetter: string;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  gpaPoints: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
