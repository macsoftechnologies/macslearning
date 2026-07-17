import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscriptionplans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'int', nullable: true })
  price: number;

  @Column({ type: 'varchar', nullable: true })
  regionId: string;

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @Column({ type: 'json', nullable: true })
  regionalPrices: any[];

  @Column({ type: 'int', default: 30 })
  durationInDays: number;

  @Column({ type: 'int', nullable: true })
  maxUsers: number;

  @Column({ type: 'int', nullable: true })
  storageGB: number;

  @Column({ type: 'json', nullable: true })
  features: Record<string, any>;

  @Column({ type: 'boolean', nullable: true, default: true })
  isActive: boolean;

  @Column({ type: 'boolean', nullable: true, default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
