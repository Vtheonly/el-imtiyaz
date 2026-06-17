export enum PaymentStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERPAID = 'overpaid',
  OVERDUE = 'overdue',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.DRAFT]: 'Draft',
  [PaymentStatus.PENDING]: 'Pending',
  [PaymentStatus.PARTIAL]: 'Partial',
  [PaymentStatus.PAID]: 'Paid',
  [PaymentStatus.OVERPAID]: 'Overpaid',
  [PaymentStatus.OVERDUE]: 'Overdue',
  [PaymentStatus.REFUNDED]: 'Refunded',
  [PaymentStatus.CANCELLED]: 'Cancelled'
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  [PaymentStatus.DRAFT]: '#6b7785',
  [PaymentStatus.PENDING]: '#c8a98c',
  [PaymentStatus.PARTIAL]: '#2b7fb0',
  [PaymentStatus.PAID]: '#3fa66e',
  [PaymentStatus.OVERPAID]: '#9b6ec1',
  [PaymentStatus.OVERDUE]: '#c0504d',
  [PaymentStatus.REFUNDED]: '#836c68',
  [PaymentStatus.CANCELLED]: '#3b464c'
};
