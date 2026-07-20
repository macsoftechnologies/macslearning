import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coursemodules')
export class CourseModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  orderIndex: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'PUBLISHED',
    enum: ['IN_REVIEW', 'PUBLISHED'],
  })
  contentStatus: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
