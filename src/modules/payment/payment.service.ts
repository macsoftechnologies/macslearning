import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
  ) {}

  async getAllPayments(organizationId: string, queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin(User, 'student', 'student.id = payment.studentId')
      .leftJoin(Course, 'course', 'course.id = payment.courseId')
      .where('payment.organizationId = :organizationId', { organizationId })
      .select([
        'payment.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'course.id as course_id',
        'course.title as course_title',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(payment.invoiceNumber LIKE :search OR payment.dummyPaymentId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const mappedData = dataRaw.map((d) => ({
      ...d,
      studentId: {
        _id: d.student_id,
        id: d.student_id,
        fullName: d.student_fullName,
        email: d.student_email,
      },
      courseId: { _id: d.course_id, id: d.course_id, title: d.course_title },
    }));

    return createPaginatedResponse(mappedData, totalItems, page, limit);
  }

  async getSuperAdminPayments(queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin(User, 'student', 'student.id = payment.studentId')
      .leftJoin(Course, 'course', 'course.id = payment.courseId')
      .select([
        'payment.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'course.id as course_id',
        'course.title as course_title',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(payment.invoiceNumber LIKE :search OR payment.dummyPaymentId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const mappedData = dataRaw.map((d) => ({
      ...d,
      studentId: {
        _id: d.student_id,
        id: d.student_id,
        fullName: d.student_fullName,
        email: d.student_email,
      },
      courseId: { _id: d.course_id, id: d.course_id, title: d.course_title },
    }));

    return createPaginatedResponse(mappedData, totalItems, page, limit);
  }

  async getMyPayments(
    organizationId: string,
    studentId: string,
    queryDto: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin(Course, 'course', 'course.id = payment.courseId')
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.studentId = :studentId', { studentId })
      .select([
        'payment.*',
        'course.id as course_id',
        'course.title as course_title',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(payment.invoiceNumber LIKE :search OR payment.dummyPaymentId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const mappedData = dataRaw.map((d) => ({
      ...d,
      courseId: { _id: d.course_id, id: d.course_id, title: d.course_title },
    }));

    return createPaginatedResponse(mappedData, totalItems, page, limit);
  }

  async generateInvoice(
    organizationId: string,
    userId: string,
    paymentId: string,
    userType: string = 'STUDENT',
  ) {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin(User, 'student', 'student.id = payment.studentId')
      .leftJoin(Course, 'course', 'course.id = payment.courseId')
      .where('payment.id = :paymentId', { paymentId })
      .andWhere('payment.organizationId = :organizationId', { organizationId })
      .select([
        'payment.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'course.id as course_id',
        'course.title as course_title',
      ]);

    if (userType === 'STUDENT') {
      queryBuilder.andWhere('payment.studentId = :userId', { userId });
    }

    const paymentRaw = await queryBuilder.getRawOne();
    if (!paymentRaw) throw new NotFoundException('Payment not found');

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (
      payment.invoiceGenerationStatus === 'GENERATED' &&
      payment.invoicePath
    ) {
      return payment;
    }

    const invoiceNumber = `INV-${Date.now()}`;
    const filename = `${invoiceNumber}.pdf`;
    const uploadsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'invoices',
    );

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Invoice Header
    doc.fontSize(25).text('Invoice', { align: 'right' });
    doc
      .fontSize(10)
      .text(`Invoice Number: ${invoiceNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);

    // Bill To
    doc.fontSize(14).text('Bill To:');
    doc.fontSize(10).text(paymentRaw.student_fullName);
    doc.text(paymentRaw.student_email);
    doc.moveDown(2);

    // Item Details
    doc.fontSize(14).text('Item Details:');
    doc.fontSize(10).text(`Course: ${paymentRaw.course_title}`);
    doc.text(`Amount: ${payment.currency} ${payment.amount}`);
    doc.moveDown(2);

    // Total
    doc.fontSize(16).text(`Total Paid: ${payment.currency} ${payment.amount}`, {
      align: 'right',
    });
    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    const invoicePath = `/uploads/invoices/${filename}`;

    payment.invoiceNumber = invoiceNumber;
    payment.invoicePath = invoicePath;
    payment.invoiceGenerationStatus = 'GENERATED';
    payment.invoiceGeneratedAt = new Date();

    return this.paymentRepository.save(payment);
  }
}
