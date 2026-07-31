import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  GenerateCertificateDto,
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
} from './dto/certificates.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('templates')
  @Roles('ORG_USER')
  async createTemplate(
    @Request() req: any,
    @Body() body: CreateCertificateTemplateDto,
  ) {
    return this.certificatesService.createTemplate(
      req.user.organizationId,
      body,
    );
  }

  @Get('templates')
  @Roles('ORG_USER', 'FACULTY')
  async listTemplates(@Request() req: any) {
    return this.certificatesService.listTemplates(req.user.organizationId);
  }

  @Get('templates/:id')
  @Roles('ORG_USER', 'FACULTY')
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    return this.certificatesService.getTemplateById(
      id,
      req.user.organizationId,
    );
  }

  @Post('templates/:id')
  @Roles('ORG_USER')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCertificateTemplateDto,
  ) {
    return this.certificatesService.updateTemplate(
      id,
      req.user.organizationId,
      body,
    );
  }

  @Post('generate')
  @Roles('ORG_USER')
  async generateCertificate(
    @Request() req: any,
    @Body() body: GenerateCertificateDto,
  ) {
    return this.certificatesService.generateCertificate(
      req.user.organizationId,
      req.user.userId,
      body.studentId,
      body.courseId,
      body.override || false,
    );
  }

  @Post('request')
  @Roles('STUDENT')
  async requestCertificate(
    @Request() req: any,
    @Body() body: GenerateCertificateDto,
  ) {
    // In a full implementation, this could write to a "CertificateRequest" collection
    // For now, if the course allows AUTO, we generate it directly.
    return this.certificatesService.generateCertificate(
      req.user.organizationId,
      req.user.userId, // student requesting for themselves
      req.user.userId,
      body.courseId,
      false, // no override
    );
  }

  @Post('approve')
  @Roles('ORG_USER', 'FACULTY')
  async approveCertificate(
    @Request() req: any,
    @Body() body: GenerateCertificateDto,
  ) {
    // Faculty approving a certificate for a student
    return this.certificatesService.generateCertificate(
      req.user.organizationId,
      req.user.userId, // issuer
      body.studentId,
      body.courseId,
      false,
    );
  }

  @Get('courses/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async getCourseCertificates(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    return this.certificatesService.getCourseCertificates(
      req.user.organizationId,
      courseId,
    );
  }

  @Get('my-certificates')
  async getMyCertificates(@Request() req: any) {
    return this.certificatesService.getMyCertificates(
      req.user.organizationId,
      req.user.userId,
    );
  }

  @Get(':id')
  async getCertificateById(
    @Request() req: any,
    @Param('id') certificateId: string,
  ) {
    const studentId =
      req.user.userType === 'STUDENT' ? req.user.userId : undefined;
    return this.certificatesService.getCertificateById(
      certificateId,
      req.user.organizationId,
      studentId,
    );
  }
}
