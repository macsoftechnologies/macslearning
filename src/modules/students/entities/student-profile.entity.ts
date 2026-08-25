import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', nullable: true })
  gender: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  maritalStatus: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @Column({ type: 'varchar', nullable: true })
  motherTongue: string;

  @Column({ type: 'varchar', nullable: true })
  otherLanguages: string;

  @Column({ type: 'varchar', nullable: true })
  countryOfCitizenship: string;

  @Column({ type: 'varchar', nullable: true })
  countryLivingIn: string;

  @Column({ type: 'date', nullable: true })
  bornAgainDate: string;

  @Column({ type: 'varchar', nullable: true })
  denomination: string;

  @Column({ type: 'varchar', nullable: true })
  localChurch: string;

  @Column({ type: 'varchar', nullable: true })
  honors: string;

  @Column({ type: 'varchar', nullable: true })
  referenceProvider: string;

  @Column({ type: 'text', nullable: true })
  churchDetails: string;

  @Column({ type: 'varchar', nullable: true })
  parentName: string;

  @Column({ type: 'varchar', nullable: true })
  parentPhone: string;

  @Column({ type: 'text', nullable: true })
  parentAddress: string;

  @Column({ type: 'varchar', nullable: true })
  baptismYear: string;

  @Column({ type: 'varchar', nullable: true })
  currentProfession: string;

  @Column({ type: 'varchar', nullable: true })
  highestEducation: string;

  @Column({ type: 'varchar', nullable: true })
  theologicalQualifications: string; // 'Yes' or 'No'

  @Column({ type: 'varchar', nullable: true })
  interestedCourse: string; // Course ID

  @Column({ type: 'text', nullable: true })
  christianExperience: string;

  @Column({ type: 'text', nullable: true })
  theologicalDesire: string;

  @Column({ type: 'varchar', nullable: true })
  howDidYouHear: string;

  @Column({ type: 'varchar', nullable: true })
  hobbies: string;

  @Column({ type: 'varchar', nullable: true })
  photo: string;

  @Column({ type: 'json', nullable: true })
  documents: {
    photo?: { url: string; name?: string } | string;
    aadhaarFront?: { url: string; name?: string } | string;
    aadhaarBack?: { url: string; name?: string } | string;
    tenthCert?: { url: string; name?: string } | string;
    interCert?: { url: string; name?: string } | string;
    degreeCert?: { url: string; name?: string } | string;
    degreeTranscript?: { url: string; name?: string } | string;
    referenceLetter?: { url: string; name?: string } | string;
    certificates?: Array<{ url: string; name?: string; size?: number } | string>;
    aadhar?: string;
    ssc?: string;
    inter?: string;
    degree?: string;
    any?: string;
    otherCopies?: string[];
  };

  @Column({ type: 'boolean', default: false })
  declarationAccepted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
