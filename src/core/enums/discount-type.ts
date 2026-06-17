export enum DiscountType {
  SCHOLARSHIP_FULL = 'scholarship_full',
  SCHOLARSHIP_PARTIAL = 'scholarship_partial',
  SIBLING = 'sibling',
  EARLY_BIRD = 'early_bird',
  STAFF_CHILD = 'staff_child',
  CUSTOM = 'custom'
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  [DiscountType.SCHOLARSHIP_FULL]: 'Full Scholarship (100%)',
  [DiscountType.SCHOLARSHIP_PARTIAL]: 'Partial Scholarship',
  [DiscountType.SIBLING]: 'Sibling Discount',
  [DiscountType.EARLY_BIRD]: 'Early Bird Discount',
  [DiscountType.STAFF_CHILD]: 'Staff Child Discount',
  [DiscountType.CUSTOM]: 'Custom Discount'
};

/**
 * Sibling discount tiers — applied automatically when a parent has more
 * than one enrolled student. The first child always pays full price.
 */
export const SIBLING_DISCOUNT_TIERS = [
  { order: 1, percentage: 0 },    // First child
  { order: 2, percentage: 10 },   // Second child: 10% off
  { order: 3, percentage: 20 },   // Third child: 20% off
  { order: 4, percentage: 30 }    // Fourth+: 30% off
] as const;
