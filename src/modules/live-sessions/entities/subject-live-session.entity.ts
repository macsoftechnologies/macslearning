import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('subject_live_sessions')
@Index(['organizationId', 'batchId'])
@Index(['courseId'])
export class SubjectLiveSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  batchId: string;

  @Column({ type: 'varchar', nullable: true })
  programId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'int', default: 1 })
  sessionNumber: number; // 1 to 5 (e.g. Call 1 of 5)

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'date' })
  scheduledDate: Date;

  @Column({ type: 'varchar' })
  scheduledTime: string; // e.g. "07:00 PM"

  @Column({ type: 'varchar', length: 500, nullable: true })
  meetingUrl: string;

  @Column({ type: 'text', nullable: true })
  agenda: string;

  @Column({
    type: 'enum',
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED',
  })
  status: string;

  @Column({ type: 'longtext', nullable: true })
  attendeeStudentIds: string; // JSON array of student IDs marked present

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
