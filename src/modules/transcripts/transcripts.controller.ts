import { Controller, Post, Body, Res, Param } from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import type { Response } from 'express';

@Controller('transcripts')
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Post('generate/:studentId')
  async generateTranscript(
    @Param('studentId') studentId: string,
    @Body() body: { conduct: string; awards: string },
    @Res() res: Response
  ) {
    const pdfBuffer = await this.transcriptsService.generatePdf(studentId, body.conduct, body.awards);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=transcript-${studentId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    

    res.end(pdfBuffer);
  }
}
