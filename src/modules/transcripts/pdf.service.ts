import { Injectable, Logger } from '@nestjs/common';
const PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateTranscriptPdf(student: any, metadata: any, grades: any[], batch: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('GLOBAL ONLINE', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('ATA Reg. Number: 12345-6789', { align: 'center' });
      doc.moveDown(2);

      // Student Info
      doc.fontSize(12).font('Helvetica-Bold').text('OFFICIAL TRANSCRIPT');
      doc.moveDown(1);
      doc.font('Helvetica').text(`Student Name: ${student.fullName || 'Unknown'}`);
      doc.text(`Degree Program: ${batch.degreeName}`);
      doc.text(`Conduct: ${metadata.conduct || 'N/A'}`);
      doc.text(`Awards: ${metadata.awards || 'N/A'}`);
      doc.moveDown(2);

      // Grades Table Header
      const startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Course ID', 50, startY);
      doc.text('Course Name', 150, startY);
      doc.text('Credits', 350, startY);
      doc.text('Grade', 420, startY);
      doc.text('GPA', 480, startY);
      doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();

      // Grades Table Rows
      let currentY = startY + 20;
      doc.font('Helvetica').fontSize(10);
      
      let totalPoints = 0;
      let totalCredits = 0;

      for (const grade of grades) {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }
        
        const credits = grade.course?.credits || 3;
        const gpa = Number(grade.gpaPoints) || 0;
        
        doc.text(grade.course?.id?.substring(0, 8) || 'N/A', 50, currentY);
        doc.text(grade.course?.title || 'Unknown Course', 150, currentY, { width: 190 });
        doc.text(credits.toString(), 350, currentY);
        doc.text(grade.gradeLetter || 'F', 420, currentY);
        doc.text(gpa.toFixed(1), 480, currentY);
        
        totalPoints += (gpa * credits);
        totalCredits += credits;
        
        currentY += 20;
      }

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      // Cumulative GPA
      const finalGpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`Cumulative GPA: ${finalGpa}`, 350, currentY);

      doc.end();
    });
  }
}
