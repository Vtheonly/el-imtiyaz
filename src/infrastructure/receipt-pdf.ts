/**
 * Receipt PDF generation service — plan §07.05.
 *
 * Thin barrel re-exporting the PDF generators that were split into
 * `./receipt-pdf/*` for clarity. Behavior is identical to the original
 * single-file module — only file locations and import paths changed.
 *
 * Generators:
 *   - generatePaymentReceiptPdf   (single-transaction receipt)
 *   - generateAccountStatementPdf (parent ledger)
 *   - generateBulletinPdf         (student term bulletin, spec §5.2)
 *   - generatePayslipPdf          (personnel payslip, spec §5.2)
 *   - generateQuotationPdf        (registration quote/invoice, spec §2.1)
 *   - downloadPdf                 (browser-side download trigger)
 */
export { generatePaymentReceiptPdf } from "./receipt-pdf/payment-receipt";
export { generateAccountStatementPdf } from "./receipt-pdf/account-statement";
export { generateBulletinPdf } from "./receipt-pdf/bulletin";
export { generatePayslipPdf } from "./receipt-pdf/payslip";
export { generateQuotationPdf } from "./receipt-pdf/quotation";
export type { QuotationInput, QuotationStudent } from "./receipt-pdf/quotation";
export { downloadPdf } from "./receipt-pdf/download";
