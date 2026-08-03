import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  name: string; // e.g. M.Div., M.A., B.Th.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 6 })
  totalSemesters: number;

  @Column({ type: 'int', default: 30 })
  totalSubjects: number;

  @Column({ type: 'json', nullable: true })
  pricing: any;

  @Column({ type: 'json', nullable: true })
  regionalPrices: any[];

  @Column({ type: 'varchar', nullable: true })
  coursePlanId: string;

  @Column({ type: 'varchar', nullable: true })
  certificateTemplateId: string;

  @Column({ type: 'enum', enum: ['AUTO', 'MANUAL_APPROVAL'], nullable: true, default: 'AUTO' })
  certificateIssueMode: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PUBLISHED'],
    default: 'DRAFT',
  })
  status: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
