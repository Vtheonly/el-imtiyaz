/**
 * Fee Schedule — the school's annual fee structure, mirroring the
 * Excel `REF` sheet plus the implicit fee tiers used in `ETAT 20262027`
 * column L formulas (e.g. =25000+205000+35000-J2).
 *
 * The Excel file encodes fee tiers implicitly inside formulas:
 *   - 25 000 DZD  → registration fee (column R / FI)
 *   - 205 000 DZD → base tuition
 *   - 35 000 DZD  → standard transport
 *   - 55 000 DZD  → premium transport / long distance
 *   - 30 000 DZD  → 1st transport installment (column W)
 *   - 15 000 DZD  → 2nd transport installment (column X)
 *   - 10 000 DZD  → 3rd transport installment (column Y)
 *
 * This entity makes those tiers explicit & editable so that:
 *   (a) the LedgerService can compute `devisAnnuel` from a schedule
 *       rather than hard-coding Excel constants, and
 *   (b) the user can change a tier (e.g. raise registration to 30 000)
 *       and every linked ledger entry re-evaluates automatically.
 *
 * A FeeSchedule is a named bundle of fee lines. Multiple schedules can
 * coexist (e.g. "Standard 2026-2027", "Sibling Discount 2026-2027").
 */

import { Identifier } from "../value-objects/identifier";

export type FeeScheduleLineType =
  | "registration"     // column R / FI
  | "tuition"          // the 205 000 line in column L formulas
  | "transport_base"   // the 35 000 line
  | "transport_premium"// the 55 000 line
  | "transport_t1"     // column W
  | "transport_t2"     // column X
  | "transport_t3"     // column Y
  | "psy"              // columns Z/AA
  | "orth"             // columns AB/AC
  | "extras"           // column AD/E-PLANT
  | "ratrapage"        // column AE
  | "custom";

export interface FeeScheduleLine {
  id: string;
  type: FeeScheduleLineType;
  label: string;
  /** Amount in DZD. */
  amount: number;
  /** Whether this line is included in the devisAnnuel computation. */
  includedInQuote: boolean;
  /** Whether this line is a payment installment (counts toward totalVersements). */
  isInstallment: boolean;
  /** Excel column this line maps to (for traceability). */
  excelColumn?: string;
}

export interface FeeSchedule {
  id: Identifier<"FeeSchedule">;
  name: string;
  description?: string;
  /** Grade level this schedule applies to (e.g. "PRIM", "ALL"). */
  gradeLevel: string;
  /** Academic year ID this schedule is active for. */
  academicYearId?: string;
  lines: FeeScheduleLine[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeScheduleInput {
  name: string;
  description?: string;
  gradeLevel: string;
  academicYearId?: string;
  lines: Array<Omit<FeeScheduleLine, "id">>;
  isActive?: boolean;
}

export type UpdateFeeScheduleInput = Partial<CreateFeeScheduleInput>;

/**
 * The default schedule that reproduces the Excel file's implicit pricing.
 * Used by LedgerService.computeDevisAnnuel when no other schedule is linked.
 */
export const DEFAULT_FEE_SCHEDULE: Array<Omit<FeeScheduleLine, "id">> = [
  { type: "registration",     label: "Registration Fee",        amount: 25000,  includedInQuote: true,  isInstallment: true,  excelColumn: "R" },
  { type: "tuition",          label: "Base Tuition",            amount: 205000, includedInQuote: true,  isInstallment: false, excelColumn: "L" },
  { type: "transport_base",   label: "Transport (standard)",    amount: 35000,  includedInQuote: true,  isInstallment: false, excelColumn: "L" },
  { type: "transport_premium",label: "Transport (premium)",     amount: 55000,  includedInQuote: true,  isInstallment: false, excelColumn: "L" },
  { type: "transport_t1",     label: "Transport T1",            amount: 30000,  includedInQuote: false, isInstallment: true,  excelColumn: "W" },
  { type: "transport_t2",     label: "Transport T2",            amount: 15000,  includedInQuote: false, isInstallment: true,  excelColumn: "X" },
  { type: "transport_t3",     label: "Transport T3",            amount: 10000,  includedInQuote: false, isInstallment: true,  excelColumn: "Y" },
];
