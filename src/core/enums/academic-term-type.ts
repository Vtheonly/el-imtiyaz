/**
 * Academic calendar term types. Schools may use semester, trimester, or
 * quarterly divisions. The system supports all three simultaneously so a
 * school can switch structure without data migration.
 */

export enum AcademicTermType {
  SEMESTER = 'semester',
  TRIMESTER = 'trimester',
  QUARTER = 'quarter',
  MONTH = 'month'
}

export const ACADEMIC_TERM_LABELS: Record<AcademicTermType, string> = {
  [AcademicTermType.SEMESTER]: 'Semester',
  [AcademicTermType.TRIMESTER]: 'Trimester',
  [AcademicTermType.QUARTER]: 'Quarter',
  [AcademicTermType.MONTH]: 'Month'
};
