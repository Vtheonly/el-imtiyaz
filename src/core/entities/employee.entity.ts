import { UserRole } from '../enums';
import { Identifier } from '../value-objects/identifier';

export interface Employee {
  id: Identifier<'Employee'>;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  title?: string;                     // "Math Teacher", "Senior Accountant"
  classIds: string[];                 // classes taught / managed
  salary?: number;                    // DZD
  hiredAt: string;
  leftAt?: string;
  isActive: boolean;
  permissions: string[];              // explicit permission overrides
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  title?: string;
  classIds?: string[];
  salary?: number;
  hiredAt?: string;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  isActive?: boolean;
  leftAt?: string;
  permissions?: string[];
};
