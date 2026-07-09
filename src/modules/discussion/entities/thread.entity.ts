import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('threads')
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar', nullable: true })
  lessonId: string;

  @Column({ type: 'varchar' })
  authorId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  content: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  views: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  replyCount: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  isResolved: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
