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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
