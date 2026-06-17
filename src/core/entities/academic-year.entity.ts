import { AcademicTermType } from '../enums';
import { Identifier } from '../value-objects/identifier';

/**
 * Academic Year — top-level container for the school calendar.
 * Example: "2026-2027".
 */
export interface AcademicYear {
  id: Identifier<'AcademicYear'>;
  name: string;                       // "2026-2027"
  startDate: string;
  endDate: string;
  termType: AcademicTermType;
  isActive: boolean;
  terms: AcademicTerm[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A term inside an academic year. Each term has a defined date range and
 * contains the months that fall within it.
 */
export interface AcademicTerm {
  id: Identifier<'Term'>;
  academicYearId: string;
  name: string;                       // "Semester 1", "Trimester 2", etc.
  type: AcademicTermType;
  startDate: string;
  endDate: string;
  months: AcademicMonth[];
  order: number;
}

export interface AcademicMonth {
  id: string;
  name: string;                       // "September"
  year: number;
  startDate: string;
  endDate: string;
}

export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
  termType: AcademicTermType;
}

export type UpdateAcademicYearInput = Partial<CreateAcademicYearInput> & {
  isActive?: boolean;
};
