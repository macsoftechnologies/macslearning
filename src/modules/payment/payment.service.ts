import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>
  ) {}

  async getAllPayments(organizationId: string, queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const filter: any = { organizationId };

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { dummyPaymentId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.paymentModel.find(filter).populate('studentId', 'fullName email').populate('courseId', 'title').sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.paymentModel.countDocuments(filter),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getMyPayments(organizationId: string, studentId: string, queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const filter: any = { organizationId, studentId };

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { dummyPaymentId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.paymentModel.find(filter).populate('courseId', 'title').sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.paymentModel.countDocuments(filter),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async generateInvoice(organizationId: string, studentId: string, paymentId: string) {
    const payment = await this.paymentModel.findOne({ _id: paymentId, organizationId, studentId }).populate('studentId', 'fullName email').populate('courseId', 'title');
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.invoiceGenerationStatus === 'GENERATED' && payment.invoicePath) {
      return payment;
    }

    const invoiceNumber = `INV-${Date.now()}`;
    const filename = `${invoiceNumber}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'invoices');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Invoice Header
    doc.fontSize(25).text('Invoice', { align: 'right' });
    doc.fontSize(10).text(`Invoice Number: ${invoiceNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);

    // Bill To
    doc.fontSize(14).text('Bill To:');
    doc.fontSize(10).text((payment.studentId as any).fullName);
    doc.text((payment.studentId as any).email);
    doc.moveDown(2);

    // Item Details
    doc.fontSize(14).text('Item Details:');
    doc.fontSize(10).text(`Course: ${(payment.courseId as any).title}`);
    doc.text(`Amount: ${payment.currency} ${payment.amount}`);
    doc.moveDown(2);

    // Total
    doc.fontSize(16).text(`Total Paid: ${payment.currency} ${payment.amount}`, { align: 'right' });
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

    return payment.save();
  }
}
