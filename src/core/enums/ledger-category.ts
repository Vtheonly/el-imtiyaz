/**
 * Catalogue of school-fee categories used by the Excel-migration ledger.
 * These mirror the implicit categorisation in the Excel `ETAT 20262027`
 * sheet (column groups) and the `Devis` sheet dropdown columns.
 */

export enum LedgerCategory {
  REGISTRATION = "registration",       // Excel column R (FI)
  TUITION_INSTALLMENT = "tuition",     // Excel columns S/T/U (V2/2V/v3)
  TRANSPORT = "transport",             // Excel columns W/X/Y (T1/T2/T3)
  EXTRAS = "extras",                   // Excel columns Z–AE (psy/orth/ePlant/ratrapage)
  QUARTERLY = "quarterly",             // Excel columns AF/AH/AJ (Sep/Dec/Mar)
  PRIOR_DEBT = "prior_debt",           // Excel column N
  REIMBURSEMENT = "reimbursement"      // Excel column M
}

export const LEDGER_CATEGORY_LABELS: Record<LedgerCategory, string> = {
  [LedgerCategory.REGISTRATION]: "Registration",
  [LedgerCategory.TUITION_INSTALLMENT]: "Tuition Installment",
  [LedgerCategory.TRANSPORT]: "Transport",
  [LedgerCategory.EXTRAS]: "Extras",
  [LedgerCategory.QUARTERLY]: "Quarterly Payment",
  [LedgerCategory.PRIOR_DEBT]: "Prior Debt",
  [LedgerCategory.REIMBURSEMENT]: "Reimbursement"
};

/** The 7 payment categories that sum into `totalVersements` (column P). */
export const VERSEMENT_CATEGORIES: LedgerCategory[] = [
  LedgerCategory.REGISTRATION,
  LedgerCategory.TUITION_INSTALLMENT,
  LedgerCategory.TRANSPORT
];

/** Maximum value allowed for `septemberBalance` (Excel data-validation rule). */
export const SEPTEMBER_BALANCE_MAX = 10000;

/** Tax rate applied to school fees in the Devis sheet (D35 = SUM(F) * 0.05). */
export const QUOTE_SCHOOL_FEE_TAX_RATE = 0.05;
