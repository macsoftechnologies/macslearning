import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { Certificate } from './entities/certificate.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Certificate,
      CertificateTemplate,
      User,
      Course,
      AssessmentResult,
    ]),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
