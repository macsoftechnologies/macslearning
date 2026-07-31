import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('transcript_metadata')
export class TranscriptMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  academicBatchId: string;

  @Column({ type: 'varchar', nullable: true })
  conduct: string;

  @Column({ type: 'varchar', nullable: true })
  awards: string;

  @Column({ type: 'varchar', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', nullable: true })
  classOfPass: string;

  @Column({ type: 'date', nullable: true })
  dateGraduated: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
