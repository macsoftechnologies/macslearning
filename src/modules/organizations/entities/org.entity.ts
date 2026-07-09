import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', nullable: true })
  domain: string;

  @Column({ type: 'json', nullable: true })
  themeColors: any;

  @Column({ type: 'json', nullable: true })
  contactInfo: any;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  loginUrl: string;

  @Column({ type: 'json', nullable: true })
  subscriptionConfig: any;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
