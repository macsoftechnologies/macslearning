import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  message: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    nullable: true,
    default: 'SYSTEM',
    enum: ['SYSTEM', 'COURSE', 'PAYMENT', 'EXAM'],
  })
  type: string;

  @Column({ type: 'varchar', nullable: true })
  link: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
