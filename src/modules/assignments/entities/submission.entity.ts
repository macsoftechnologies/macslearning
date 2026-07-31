import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  assignmentId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'PENDING',
    enum: ['PENDING', 'GRADED', 'REJECTED'],
  })
  status: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isLate: boolean;

  @Column({ type: 'int', nullable: true, default: 0 })
  marksObtained: number;

  @Column({ type: 'varchar', nullable: true })
  feedback: string;

  @Column({ type: 'varchar', nullable: true })
  gradedBy: string;

  @Column({ type: 'datetime', nullable: true })
  gradedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
