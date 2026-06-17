import { Identifier } from '../value-objects/identifier';

/**
 * Receipt — generated whenever a payment is recorded. Contains the QR code
 * payload (signed receipt number) for verification.
 */
export interface Receipt {
  id: Identifier<'Receipt'>;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  generatedAt: string;
  generatedByEmployeeId?: string;
  pdfPath: string;                    // generated PDF file path
  qrPayload: string;                  // signed payload for verification
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptTemplate {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  logoPath?: string;
  footerNote?: string;
}
