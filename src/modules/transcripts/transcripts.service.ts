<<<<<<< HEAD
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
=======
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicBatch } from './entities/academic-batch.entity';
import { OfflineGrade } from './entities/offline-grade.entity';
import { TranscriptMetadata } from './entities/transcript-metadata.entity';
import { PdfService } from './pdf.service';

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);

  constructor(
    @InjectRepository(AcademicBatch) private batchRepo: Repository<AcademicBatch>,
    @InjectRepository(OfflineGrade) private gradeRepo: Repository<OfflineGrade>,
    @InjectRepository(TranscriptMetadata) private metadataRepo: Repository<TranscriptMetadata>,
    private pdfService: PdfService,
  ) {}

  // --- Batches ---
  async createBatch(orgId: string, dto: any) {
    const batch = this.batchRepo.create({ ...dto, organizationId: orgId });
    return this.batchRepo.save(batch);
  }

  async listBatches(orgId: string) {
    return this.batchRepo.find({ where: { organizationId: orgId }, order: { createdAt: 'DESC' } });
  }

  async getBatch(orgId: string, id: string) {
    return this.batchRepo.findOne({ where: { organizationId: orgId, id } });
  }

  async updateBatch(orgId: string, id: string, dto: any) {
    await this.batchRepo.update({ organizationId: orgId, id }, dto);
    return this.getBatch(orgId, id);
  }

  // --- Gradebook ---
  calculateGrade(total: number) {
    if (total >= 90) return { letter: 'A+', gpa: 4.3 };
    if (total >= 85) return { letter: 'A', gpa: 4.0 };
    if (total >= 80) return { letter: 'A-', gpa: 3.7 };
    if (total >= 75) return { letter: 'B+', gpa: 3.3 };
    if (total >= 70) return { letter: 'B', gpa: 3.0 };
    if (total >= 65) return { letter: 'B-', gpa: 2.7 };
    if (total >= 60) return { letter: 'C+', gpa: 2.3 };
    if (total >= 55) return { letter: 'C', gpa: 2.0 };
    if (total >= 50) return { letter: 'C-', gpa: 1.7 };
    return { letter: 'F', gpa: 0.0 };
  }

  async saveGrades(orgId: string, batchId: string, courseId: string, grades: any[]) {
    // grades: [{ studentId, assignmentMarks, finalExamMarks }]
    const savedGrades = [];
    
    for (const g of grades) {
      let existing = await this.gradeRepo.findOne({
        where: { organizationId: orgId, academicBatchId: batchId, courseId, studentId: g.studentId }
      });

      const assignmentMarks = Number(g.assignmentMarks) || 0;
      const finalExamMarks = Number(g.finalExamMarks) || 0;
      const totalMarks = assignmentMarks + finalExamMarks;
      
      const { letter, gpa } = this.calculateGrade(totalMarks);

      if (existing) {
        existing.assignmentMarks = assignmentMarks;
        existing.finalExamMarks = finalExamMarks;
        existing.totalMarks = totalMarks;
        existing.gradeLetter = letter;
        existing.gpaPoints = gpa;
        savedGrades.push(await this.gradeRepo.save(existing));
      } else {
        const newGrade = this.gradeRepo.create({
          organizationId: orgId,
          academicBatchId: batchId,
          courseId,
          studentId: g.studentId,
          assignmentMarks,
          finalExamMarks,
          totalMarks,
          gradeLetter: letter,
          gpaPoints: gpa,
        });
        savedGrades.push(await this.gradeRepo.save(newGrade));
      }
    }
    return savedGrades;
  }

  async getGrades(orgId: string, batchId: string, courseId: string) {
    return this.gradeRepo.find({
      where: { organizationId: orgId, academicBatchId: batchId, courseId }
    });
  }

  async generatePdfStub(orgId: string, studentId: string, batchId: string) {
    const batch = await this.batchRepo.findOne({ where: { id: batchId, organizationId: orgId } });
    const metadata = await this.metadataRepo.findOne({ where: { studentId, academicBatchId: batchId, organizationId: orgId } }) || {};
    
    // Get all grades for this student in this batch across all courses
    const grades = await this.gradeRepo.find({
      where: { organizationId: orgId, academicBatchId: batchId, studentId }
    });

    // We would normally join to get course title and credits, 
    // for this stub we map it directly if the join isn't configured in the entity.
    const mappedGrades = grades.map(g => ({
      ...g,
      course: { id: g.courseId, title: `Course ${g.courseId.substring(0, 4)}`, credits: 3 }
    }));

    return this.pdfService.generateTranscriptPdf(
      { fullName: 'John Doe' }, // Stub student
      metadata,
      mappedGrades,
      batch || { degreeName: 'M.Div' }
    );
  }
>>>>>>> de2e6a8d3bf1245059e9b7102e13239482f7812c
}
