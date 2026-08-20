import { Controller, Post, Get, Body, Res, Param, Request, UseGuards } from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Response } from 'express';

@Controller('transcripts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Post('generate/:studentId')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async generateTranscript(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body() body: { conduct: string; awards: string },
    @Res() res: Response
  ) {
    const pdfBuffer = await this.transcriptsService.generatePdf(req.user.organizationId, studentId, body.conduct, body.awards);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=transcript-${studentId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    

    res.end(pdfBuffer);
  }


  @Get('my-grades')
  @Roles('STUDENT')
  async getMyGrades(@Request() req: any) {
    return this.transcriptsService.getMyGrades(req.user.organizationId, req.user.id);
  }
}

