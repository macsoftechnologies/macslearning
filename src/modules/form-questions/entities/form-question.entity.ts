import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FormQuestionType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  DROPDOWN = 'DROPDOWN',
  DATE = 'DATE',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
  FILE = 'FILE',
}

@Entity('form_questions')
export class FormQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  organizationId: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'varchar' })
  key: string;

  @Column({
    type: 'enum',
    enum: FormQuestionType,
    default: FormQuestionType.TEXT,
  })
  type: string;

  @Column({ type: 'json', nullable: true })
  options: string[]; // For dropdowns, radios, checkboxes

  @Column({ default: false })
  isRequired: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
