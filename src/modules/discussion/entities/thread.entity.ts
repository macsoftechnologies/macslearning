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

  @Column({ type: 'varchar', default: 'COURSE_FORUM' })
  threadType: string; // 'COURSE_FORUM' | 'BATCH_GROUP' | 'DIRECT_MESSAGE'

  @Column({ type: 'varchar', nullable: true })
  courseId: string;

  @Column({ type: 'varchar', nullable: true })
  batchId: string;

  @Column({ type: 'varchar', nullable: true })
  lessonId: string;

  @Column({ type: 'varchar' })
  authorId: string;

  @Column({ type: 'varchar', nullable: true })
  recipientId: string; // Target user ID for 1-on-1 direct messages

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  lastMessage: string;

  @Column({ type: 'datetime', nullable: true })
  lastMessageAt: Date;

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
