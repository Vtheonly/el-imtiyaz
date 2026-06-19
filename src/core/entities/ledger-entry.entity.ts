/**
 * Ledger Entry — one row in the school-fees master ledger.
 *
 * This is the in-app equivalent of one row in the Excel sheet
 * `ETAT 20262027`. It mirrors the Excel column schema exactly so that
 * the spreadsheet remains the source of truth and the app follows it.
 *
 * Excel column mapping (header → field):
 *   B  INFOS                → infos
 *   C  E-MAIL               → email
 *   D  NEM                  → phoneNumbers
 *   E  TUTEUR               → tutorName
 *   F  NOM                  → studentName (denormalised; links via studentId)
 *   G  niveau               → level
 *   H  CLASSE               → classCode
 *   I  OPTION               → optionCode
 *   J  REMISE               → remise (discount)
 *   K  JUSTIFICATION        → justification
 *   L  DEVIS ANNUEL         → *computed* devisAnnuel
 *   M  REMBOURCEMENT        → reimbursement
 *   N  DETTES               → priorDebt
 *   O  REGLEMENTS DETTES    → debtSettlement
 *   P  TOTAL VERSEMENTS     → *computed* totalVersements
 *   Q  TOTAL*CREANCE        → *computed* totalCreance (outstanding)
 *   R  FI                   → fi (registration fee paid)
 *   S  V2                   → v2
 *   T  2V                   → altV2
 *   U  v3                   → v3
 *   V  DISTINATION          → destination
 *   W  1T                   → t1 (transport 1)
 *   X  T2                   → t2
 *   Y  t3                   → t3
 *   Z  PSY1                 → psy1
 *   AA PSY2                 → psy2
 *   AB ORTH1                → orth1
 *   AC ORTH2                → orth2
 *   AD E-PLANT              → ePlant
 *   AE Ratrapage            → ratrapage
 *   AF SEPTEMBRE            → september
 *   AG CREANCES SEPTEMBRE   → septemberBalance (validation: < 10000)
 *   AH DECEMBRE             → december
 *   AI CREANCES DECEMBRE    → decemberBalance
 *   AJ MARS                 → march
 *   AK CREANCES MARS        → marchBalance
 *   AL TOTAL                → grandTotal
 *   AM (audit comments)     → handled via PaymentAuditComment entity
 */

import { Identifier } from "../value-objects/identifier";

/** Excel column letter → canonical field name. Kept in sync with the schema above. */
export const LEDGER_COLUMN_MAP = {
  B: "infos",
  C: "email",
  D: "phoneNumbers",
  E: "tutorName",
  F: "studentName",
  G: "level",
  H: "classCode",
  I: "optionCode",
  J: "remise",
  K: "justification",
  L: "devisAnnuel",
  M: "reimbursement",
  N: "priorDebt",
  O: "debtSettlement",
  P: "totalVersements",
  Q: "totalCreance",
  R: "fi",
  S: "v2",
  T: "altV2",
  U: "v3",
  V: "destination",
  W: "t1",
  X: "t2",
  Y: "t3",
  Z: "psy1",
  AA: "psy2",
  AB: "orth1",
  AC: "orth2",
  AD: "ePlant",
  AE: "ratrapage",
  AF: "september",
  AG: "septemberBalance",
  AH: "december",
  AI: "decemberBalance",
  AJ: "march",
  AK: "marchBalance",
  AL: "grandTotal",
} as const;

export type LedgerFieldName = typeof LEDGER_COLUMN_MAP[keyof typeof LEDGER_COLUMN_MAP];

export interface LedgerEntry {
  id: Identifier<"LedgerEntry">;
  /** Linked student (optional — Excel rows may be unlinked initially). */
  studentId?: string;
  /** Linked academic year (e.g. "2026-2027"). */
  academicYearId?: string;
  /** Excel row number this entry was imported from (for traceability). */
  sourceRow?: number;

  // ── Identity / descriptive (cols B–I) ──
  infos?: string;
  email?: string;
  phoneNumbers: string;        // raw, slash-separated as in Excel
  tutorName?: string;
  studentName: string;
  level?: string;              // "PRIM", "MAT", etc.
  classCode?: string;          // "CE1", "CM2", etc.
  optionCode?: string;         // "TRNSP" etc.

  // ── Discount / quote inputs (cols J–K) ──
  remise: number;              // discount amount in DZD
  justification?: string;

  // ── Computed values (cols L, P, Q — reproduced from Excel formulas) ──
  devisAnnuel: number;         // = reg + tuition + transport + extras − remise
  totalVersements: number;     // = fi + v2 + altV2 + v3 + t1 + t2 + t3
  totalCreance: number;        // = devisAnnuel − totalVersements

  // ── Debt carry-over (cols M–O) ──
  reimbursement?: number;
  priorDebt?: number;
  debtSettlement?: number;

  // ── Payment installments (cols R–Y) ──
  fi: number;                  // registration fee payment
  v2: number;                  // 2nd installment
  altV2: number;               // alternate 2nd-installment slot
  v3: number;                  // 3rd installment
  destination?: string;        // transport destination
  t1: number;                  // transport payment 1
  t2: number;                  // transport payment 2
  t3: number;                  // transport payment 3

  // ── Extras (cols Z–AE) ──
  psy1: number;
  psy2: number;
  orth1: number;
  orth2: number;
  ePlant: number;
  ratrapage: number;

  // ── Quarterly tracking (cols AF–AK) ──
  september: number;
  septemberBalance?: number;   // validation: < 10000 DZD
  december: number;
  decemberBalance?: number;
  march: number;
  marchBalance?: number;

  // ── Grand total (col AL) ──
  grandTotal: number;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Input shape for creating a new ledger entry. Required fields only. */
export interface CreateLedgerEntryInput {
  studentId?: string;
  academicYearId?: string;
  sourceRow?: number;
  studentName: string;
  phoneNumbers?: string;
  remise?: number;
  // All numeric columns are optional on input — defaults to 0.
  fi?: number;
  v2?: number;
  altV2?: number;
  v3?: number;
  t1?: number;
  t2?: number;
  t3?: number;
  psy1?: number;
  psy2?: number;
  orth1?: number;
  orth2?: number;
  ePlant?: number;
  ratrapage?: number;
  september?: number;
  december?: number;
  march?: number;
  // Optional overrides — if not supplied, the service computes them.
  devisAnnuel?: number;
  reimbursement?: number;
  priorDebt?: number;
  debtSettlement?: number;
  infos?: string;
  email?: string;
  tutorName?: string;
  level?: string;
  classCode?: string;
  optionCode?: string;
  destination?: string;
  justification?: string;
}

export type UpdateLedgerEntryInput = Partial<CreateLedgerEntryInput> & {
  septemberBalance?: number;
  decemberBalance?: number;
  marchBalance?: number;
};
