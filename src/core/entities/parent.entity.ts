import { Identifier } from '../value-objects/identifier';

export interface Parent {
  id: Identifier<'Parent'>;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  occupation?: string;
  relationship: 'father' | 'mother' | 'guardian' | 'other';
  address?: {
    line1: string;
    city: string;
    country: string;
  };
  notes?: string;
  studentIds: string[];          // denormalised cache for fast lookup
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateParentInput {
  firstName: string;
  lastName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  occupation?: string;
  relationship: Parent['relationship'];
  address?: Parent['address'];
  notes?: string;
}

export type UpdateParentInput = Partial<CreateParentInput>;
