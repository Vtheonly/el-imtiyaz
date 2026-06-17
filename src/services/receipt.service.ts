/**
 * Receipt service — generates PDF receipts with QR codes for verification.
 */

import path from 'node:path';
import fs from 'node:fs';
import QRCode from 'qrcode';
import { ReceiptRepository } from '../infrastructure/repositories/receipt.repository';
import { PaymentRepository } from '../infrastructure/repositories/payment.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import type { Receipt } from '../core/entities/receipt.entity';
import { exportTableToPdf } from '../infrastructure/export/pdf-exporter';
import { NotFoundError, InfrastructureError } from '../infrastructure/error/app-error';
import { logger } from '../infrastructure/logger/logger';
import { app } from 'electron';

const RECEIPT_TEMPLATE = {
  schoolName: 'El-Imtiyaz Private School',
  schoolAddress: 'Algiers, Algeria',
  schoolPhone: '+213 00 00 00 00',
  schoolEmail: 'contact@el-imtiyaz.dz',
  footerNote: 'This receipt is computer-generated and valid without signature. Thank you for your payment.'
};

export class ReceiptService {
  readonly serviceName = 'ReceiptService';

  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly payments: PaymentRepository
  ) {}

  async generate(paymentId: string, generatedByEmployeeId?: string): Promise<Receipt> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment', paymentId);

    // Check if a receipt already exists for this payment
    const existing = await this.receipts.list({ paymentId });
    if (existing.length > 0) return existing[0];

    // Generate QR payload (signed-like format — for real prod use a JWT)
    const qrPayload = JSON.stringify({
      rcp: payment.receiptNumber,
      stu: payment.studentId,
      amt: payment.amount,
      dt: payment.paymentDate,
      v: 1
    });

    // Generate QR PNG
    const userDataPath = app.getPath('userData');
    const receiptsDir = path.join(userDataPath, 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });

    const qrPath = path.join(receiptsDir, `${payment.receiptNumber}-qr.png`);
    await QRCode.toFile(qrPath, qrPayload, {
      width: 200,
      margin: 1,
      color: { dark: '#242526', light: '#FFFFFF' }
    });

    // Generate receipt PDF
    const pdfPath = path.join(receiptsDir, `${payment.receiptNumber}.pdf`);
    await exportTableToPdf({
      title: RECEIPT_TEMPLATE.schoolName,
      subtitle: `Receipt #${payment.receiptNumber} — ${RECEIPT_TEMPLATE.schoolAddress}`,
      columns: [
        { header: 'Field', width: 180 },
        { header: 'Value', width: '*' }
      ],
      rows: [
        ['Receipt Number', payment.receiptNumber],
        ['Student ID', payment.studentId],
        ['Payment Date', payment.paymentDate],
        ['Amount', `${payment.amount.toFixed(2)} DZD`],
        ['Payment Method', payment.paymentMethod],
        ['Reference', payment.reference ?? '-'],
        ['Notes', payment.notes ?? '-']
      ],
      outputPath: pdfPath,
      footer: RECEIPT_TEMPLATE.footerNote
    });

    // Persist receipt metadata
    const receipt = await this.receipts.create({
      receiptNumber: payment.receiptNumber,
      paymentId: payment.id.value,
      studentId: payment.studentId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      generatedAt: new Date().toISOString(),
      generatedByEmployeeId,
      pdfPath,
      qrPayload
    });

    logger.info('receipt.generated', {
      id: receipt.id.value,
      receiptNumber: receipt.receiptNumber,
      pdfPath
    });

    return receipt;
  }

  async list(query: { studentId?: string; from?: string; to?: string } = {}): Promise<Receipt[]> {
    return this.receipts.list(query);
  }

  async getById(id: string): Promise<Receipt> {
    const receipt = await this.receipts.findById(id);
    if (!receipt) throw new NotFoundError('Receipt', id);
    return receipt;
  }

  async voidReceipt(id: string, voidedBy: string, reason: string): Promise<Receipt> {
    const receipt = await this.getById(id);
    if (receipt.voidedAt) {
      throw new InfrastructureError('Receipt is already voided');
    }
    return this.receipts.update(id, {
      voidedAt: new Date().toISOString(),
      voidedBy
    });
  }
}
