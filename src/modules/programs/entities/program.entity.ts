import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string; // e.g. M.Div., M.A., B.Th.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 6 })
  totalSemesters: number;

  @Column({ type: 'int', default: 30 })
  totalSubjects: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PUBLISHED'],
    default: 'DRAFT',
  })
  status: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
