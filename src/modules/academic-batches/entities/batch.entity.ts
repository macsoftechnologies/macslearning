import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('region_cohorts')
export class RegionCohort {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  name: string; // e.g. "March 2026 Batch"

  @Column({ type: 'varchar' })
  regionConfigId: string; // reference to RegionConfig

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  deadlineDate: Date; // The shared deadline for this batch

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
