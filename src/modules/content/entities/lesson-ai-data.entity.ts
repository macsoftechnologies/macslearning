import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lesson_ai_data')
@Index(['organizationId', 'courseId', 'lessonId'], { unique: true })
export class LessonAiData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  courseId: string;

  @Column({ type: 'varchar' })
  lessonId: string;

  @Column({ type: 'varchar', nullable: true })
  vimeoVideoId: string;

  @Column({ type: 'longtext', nullable: true })
  summary: string;

  @Column({ type: 'json', nullable: true })
  quizPool: any[];

  @Column({ type: 'json', nullable: true })
  backstory: any[];

  @Column({ type: 'json', nullable: true })
  keyTakeaways: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
