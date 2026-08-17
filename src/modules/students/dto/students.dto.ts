import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  regionId?: string;

  @IsOptional()
  gender?: string;

  @IsOptional()
  maritalStatus?: string;

  @IsOptional()
  dateOfBirth?: string;

  @IsOptional()
  motherTongue?: string;

  @IsOptional()
  otherLanguages?: string;

  @IsOptional()
  countryOfCitizenship?: string;

  @IsOptional()
  bornAgainDate?: string;

  @IsOptional()
  denomination?: string;

  @IsOptional()
  localChurch?: string;

  @IsOptional()
  honors?: string;

  @IsOptional()
  referenceProvider?: string;

  @IsOptional()
  churchDetails?: string;

  @IsOptional()
  parentName?: string;

  @IsOptional()
  parentPhone?: string;

  @IsOptional()
  parentAddress?: string;

  @IsOptional()
  baptismYear?: string;

  @IsOptional()
  currentProfession?: string;

  @IsOptional()
  highestEducation?: string;

  @IsOptional()
  theologicalQualifications?: string;

  @IsOptional()
  interestedCourse?: string;

  @IsOptional()
  christianExperience?: string;

  @IsOptional()
  theologicalDesire?: string;

  @IsOptional()
  howDidYouHear?: string;

  @IsOptional()
  hobbies?: string;

  @IsOptional()
  photo?: string;

  @IsOptional()
  documents?: any;

  @IsOptional()
  declarationAccepted?: boolean;
}

export class RejectStudentDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
