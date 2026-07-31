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

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
