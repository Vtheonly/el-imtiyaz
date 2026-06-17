export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHEQUE = 'cheque',
  CARD = 'card',
  POSTAL_ORDER = 'postal_order',
  BARIDIEMOB = 'baridimob',   // Algerian postal mobile payment
  OTHER = 'other'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Cash',
  [PaymentMethod.BANK_TRANSFER]: 'Bank Transfer',
  [PaymentMethod.CHEQUE]: 'Cheque',
  [PaymentMethod.CARD]: 'Card',
  [PaymentMethod.POSTAL_ORDER]: 'Postal Order',
  [PaymentMethod.BARIDIEMOB]: 'BaridiMob',
  [PaymentMethod.OTHER]: 'Other'
};
