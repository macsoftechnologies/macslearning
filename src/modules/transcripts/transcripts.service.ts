
import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class TranscriptsService {
  async generatePdf(studentId: string, conduct: string, awards: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Header
        doc.fontSize(20).text('GLOBAL ONLINE – with ATA Reg. Number.', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text('COTR Theological Seminary', { align: 'center' });
        doc.fontSize(12).text('Academic Record', { align: 'center' });
        doc.moveDown();
        
        // Student Info
        doc.fontSize(12).text(`Student ID: ${studentId}`);
        doc.text(`Conduct: ${conduct}`);
        doc.text(`Awards / Class: ${awards}`);
        doc.moveDown();

        // Table Header
        doc.text('-------------------------------------------------------------');
        doc.text('Course Name | Credit Earned | Marks | Grade | Points');
        doc.text('-------------------------------------------------------------');
        
        // Mock data
        doc.text('Systematic Theology 1 | 3 | 75 | A | 4.0');
        doc.text('Pentateuch            | 3 | 82 | A+ | 4.3');
        doc.text('Romans                | 3 | 68 | B+ | 3.3');
        
        doc.text('-------------------------------------------------------------');
        doc.text('Total Points: 11.6 | GPA: 3.86');

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

}
