/**
 * Catalogue of fee types a private school typically charges.
 * The `CUSTOM` value lets staff create ad-hoc fees without code changes.
 */

export enum PaymentType {
  REGISTRATION = 'registration',
  MONTHLY_TUITION = 'monthly_tuition',
  QUARTERLY_TUITION = 'quarterly_tuition',
  ANNUAL_TUITION = 'annual_tuition',
  TRANSPORTATION = 'transportation',
  CAFETERA = 'cafeteria',
  UNIFORM = 'uniform',
  BOOKS = 'books',
  ACTIVITIES = 'activities',
  EXAMS = 'exams',
  CUSTOM = 'custom'
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.REGISTRATION]: 'Registration Fee',
  [PaymentType.MONTHLY_TUITION]: 'Monthly Tuition',
  [PaymentType.QUARTERLY_TUITION]: 'Quarterly Tuition',
  [PaymentType.ANNUAL_TUITION]: 'Annual Tuition',
  [PaymentType.TRANSPORTATION]: 'Transportation',
  [PaymentType.CAFETERA]: 'Cafeteria',
  [PaymentType.UNIFORM]: 'Uniform',
  [PaymentType.BOOKS]: 'Books',
  [PaymentType.ACTIVITIES]: 'Activities',
  [PaymentType.EXAMS]: 'Exams',
  [PaymentType.CUSTOM]: 'Custom Fee'
};

/** Recurring fees are linked to an academic period; one-off fees are not. */
export const RECURRING_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.MONTHLY_TUITION,
  PaymentType.QUARTERLY_TUITION,
  PaymentType.ANNUAL_TUITION,
  PaymentType.TRANSPORTATION,
  PaymentType.CAFETERA
];
