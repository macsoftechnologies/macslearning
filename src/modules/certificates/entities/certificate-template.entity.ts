import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('templatefields')
export class TemplateField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', nullable: true })
  variable: string;

  @Column({ type: 'varchar', nullable: true })
  value: string;

  @Column({ type: 'varchar', nullable: true })
  url: string;

  @Column({ type: 'int' })
  x: number;

  @Column({ type: 'int' })
  y: number;

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ type: 'int', nullable: true })
  fontSize: number;

  @Column({ type: 'varchar', nullable: true })
  fontFamily: string;

  @Column({ type: 'varchar', nullable: true })
  color: string;

  @Column({ type: 'varchar', nullable: true })
  textAlign: string;

  @Column({ type: 'int', nullable: true })
  opacity: number;
}

@Entity('certificatetemplates')
export class CertificateTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true, default: 'BLANK' })
  backgroundType: string;

  @Column({ type: 'varchar', nullable: true })
  backgroundImageUrl: string;

  @Column({ type: 'json', nullable: true })
  fields: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
