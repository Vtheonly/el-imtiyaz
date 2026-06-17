import { Identifier } from '../value-objects/identifier';

/**
 * Class entity — represents a section of a grade (e.g. "Grade 1 A").
 * Capacity is enforced at the service layer when enrolling students.
 */
export interface Class {
  id: Identifier<'Class'>;
  grade: string;                      // "Grade 1", "Year 3", "Terminale"
  section: string;                    // "A", "B", "Science"
  name: string;                       // derived: "Grade 1 A"
  classroom?: string;                 // physical room name
  capacity: number;
  homeroomTeacherId?: string;
  academicYearId?: string;
  enrolledCount: number;              // denormalised for fast capacity checks
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateClassInput {
  grade: string;
  section: string;
  classroom?: string;
  capacity: number;
  homeroomTeacherId?: string;
  academicYearId?: string;
}

export type UpdateClassInput = Partial<CreateClassInput>;
