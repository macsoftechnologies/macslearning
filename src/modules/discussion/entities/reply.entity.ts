import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('replys')
export class Reply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  threadId: string;

  @Column({ type: 'varchar' })
  authorId: string;

  @Column({ type: 'varchar' })
  content: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isAcceptedAnswer: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
