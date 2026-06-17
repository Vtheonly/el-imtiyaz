/**
 * Student entity — the core record of the system. Designed so a single
 * student can be linked to multiple parents, multiple classes (over time),
 * and a long history of payments & documents.
 *
 * NOTE: this is a domain entity, not a database row. Repository
 * implementations are responsible for persistence mapping.
 */

import { Gender, StudentStatus } from '../enums';
import { Identifier } from '../value-objects/identifier';

export interface StudentDocument {
  id: string;
  type: 'birth_certificate' | 'school_certificate' | 'medical' | 'contract' | 'parent_agreement' | 'other';
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Student {
  id: Identifier<'Student'>;
  studentCode: string;               // human-readable ID like "STU-2026-001"
  firstName: string;
  lastName: string;
  middleName?: string;
  fullName: string;                  // derived, but persisted for fast queries
  photoPath?: string;
  dateOfBirth: string;               // ISO date
  placeOfBirth?: string;
  gender: Gender;
  parentIds: string[];               // multiple guardians supported
  primaryParentId?: string;
  phoneNumbers: string[];
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  emergencyContacts: EmergencyContact[];
  registeredAt: string;              // ISO timestamp
  status: StudentStatus;
  classId?: string;
  academicYearId?: string;
  notes?: string;
  documents: StudentDocument[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: Gender;
  parentIds: string[];
  primaryParentId?: string;
  phoneNumbers?: string[];
  address: Student['address'];
  emergencyContacts?: EmergencyContact[];
  classId?: string;
  academicYearId?: string;
  notes?: string;
  photoPath?: string;
}

export type UpdateStudentInput = Partial<CreateStudentInput> & {
  status?: StudentStatus;
  notes?: string;
};
