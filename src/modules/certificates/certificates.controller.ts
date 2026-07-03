import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GenerateCertificateDto } from './dto/certificates.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('generate')
  @Roles('ORG_USER')
  async generateCertificate(
    @Request() req: any,
    @Body() body: GenerateCertificateDto
  ) {
    return this.certificatesService.generateCertificate(
      req.user.organizationId,
      req.user.userId,
      body.studentId,
      body.courseId,
      body.override || false,
    );
  }

  @Get('my-certificates')
  async getMyCertificates(@Request() req: any) {
    return this.certificatesService.getMyCertificates(req.user.organizationId, req.user.userId);
  }

  @Get(':id')
  async getCertificateById(@Request() req: any, @Param('id') certificateId: string) {
    const studentId = req.user.userType === 'STUDENT' ? req.user.userId : undefined;
    return this.certificatesService.getCertificateById(certificateId, req.user.organizationId, studentId);
  }
}
