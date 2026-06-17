import { DiscountType } from '../enums';
import { Identifier } from '../value-objects/identifier';

/**
 * Fee Template — reusable charge plan for a grade level.
 * Example: "Kindergarten" plan → Registration 100 DZD, Monthly 50 DZD.
 * Templates are applied to many students at once via the FeeTemplateService.
 */
export interface FeeTemplate {
  id: Identifier<'FeeTemplate'>;
  name: string;
  description?: string;
  gradeLevel: string;                 // "Kindergarten", "High School"
  items: FeeTemplateItem[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeTemplateItem {
  type: string;                       // matches PaymentType enum value
  label: string;
  amount: number;                     // DZD
  recurrence: 'one_time' | 'monthly' | 'quarterly' | 'annual';
}

export interface CreateFeeTemplateInput {
  name: string;
  description?: string;
  gradeLevel: string;
  items: FeeTemplateItem[];
}

/**
 * Scholarship — granted discount on tuition. Stored as a separate entity so
 * it can be reviewed & revoked without touching invoices directly.
 */
export interface Scholarship {
  id: Identifier<'Scholarship'>;
  studentId: string;
  type: DiscountType;
  percentage: number;                 // 0–100
  reason: string;
  grantedByEmployeeId: string;
  grantedAt: string;
  validFrom: string;
  validUntil?: string;
  revokedAt?: string;
  revokedReason?: string;
  isActive: boolean;
}
