import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  moduleId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['VIDEO', 'PDF', 'TEXT', 'INTERACTIVE'] })
  type: string;

  @Column({ type: 'varchar', nullable: true })
  contentUrl: string;

  @Column({ type: 'varchar', nullable: true })
  videoUrl: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  durationMinutes: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  orderIndex: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
