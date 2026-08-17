import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('region_configs')
export class RegionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  programId: string;

  @Column({ type: 'varchar' })
  regionName: string; // e.g., 'India', 'US'

  @Column({ type: 'boolean', default: false })
  hasFixedBatches: boolean;

  @Column({ type: 'int', nullable: true })
  customDurationYears: number; // overrides program's default duration

  @Column({ type: 'json', nullable: true })
  batchDateRanges: { startMonth: string; endMonth: string }[]; // e.g., [{startMonth: "March", endMonth: "September"}]

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
