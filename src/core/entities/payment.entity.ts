import { PaymentMethod, PaymentStatus, PaymentType } from '../enums';
import { Identifier } from '../value-objects/identifier';

/**
 * A Payment represents money RECEIVED from a parent/student against one or
 * more invoices. The system supports partial payments & installments by
 * allowing multiple payments per invoice.
 */
export interface Payment {
  id: Identifier<'Payment'>;
  receiptNumber: string;             // human-readable, e.g. "RCP-2026-00001"
  studentId: string;
  parentIds: string[];               // who actually paid
  invoiceIds: string[];              // invoices this payment settles
  amount: number;                    // DZD
  paymentDate: string;               // ISO
  paymentMethod: PaymentMethod;
  reference?: string;                // cheque number, transfer ref, etc.
  receivedByEmployeeId?: string;     // employee who collected the payment
  notes?: string;
  status: PaymentStatus;
  attachments?: string[];            // file paths to scanned cheques etc.
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreatePaymentInput {
  studentId: string;
  parentIds?: string[];
  invoiceIds?: string[];
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  receivedByEmployeeId?: string;
  notes?: string;
}

export type UpdatePaymentInput = Partial<CreatePaymentInput> & {
  status?: PaymentStatus;
};

/**
 * Invoice — a charge raised against a student. The outstanding balance is
 * computed from invoice amount − sum of linked payments.
 */
export interface Invoice {
  id: Identifier<'Invoice'>;
  invoiceNumber: string;
  studentId: string;
  academicYearId?: string;
  termId?: string;
  type: PaymentType;
  description: string;
  amountDue: number;                  // original amount in DZD
  discountAmount: number;             // applied discount in DZD
  amountPaid: number;                 // sum of linked payments
  status: PaymentStatus;
  dueDate?: string;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateInvoiceInput {
  studentId: string;
  academicYearId?: string;
  termId?: string;
  type: PaymentType;
  description: string;
  amountDue: number;
  discountAmount?: number;
  dueDate?: string;
}
