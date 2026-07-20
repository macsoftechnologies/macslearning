import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'DRAFT',
    enum: ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'],
  })
  status: string;

  @Column({ type: 'json', nullable: true })
  pricing: any;

  @Column({ type: 'json', nullable: true })
  regionalPrices: any[];
  @Column({ type: 'json', nullable: true })
  instructorIds: string[];

  @Column({ type: 'varchar', nullable: true })
  categoryId: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @Column({ type: 'varchar', nullable: true })
  coursePlanId: string;

  @Column({ type: 'int', nullable: true })
  validityDays: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  enrolledCount: number;

  @Column({ type: 'varchar', nullable: true })
  certificateTemplateId: string;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'AUTO',
    enum: ['AUTO', 'MANUAL_APPROVAL'],
  })
  certificateIssueMode: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
