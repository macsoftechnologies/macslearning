import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { Certificate, CertificateSchema } from './schemas/certificate.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { AssessmentResult, AssessmentResultSchema } from '../results/schemas/assessmentResult.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Certificate.name, schema: CertificateSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: AssessmentResult.name, schema: AssessmentResultSchema },
    ])
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService]
})
export class CertificatesModule {}
