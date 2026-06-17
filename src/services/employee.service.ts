/**
 * Employee service — manages staff records & permissions.
 */

import { EmployeeRepository } from '../infrastructure/repositories/employee.repository';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput } from '../core/entities/employee.entity';
import { UserRole } from '../core/enums';
import { can, Permission } from '../core/enums/user-role';
import { NotFoundError, PermissionError, ValidationError } from '../infrastructure/error/app-error';

interface EmployeeQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export class EmployeeService {
  readonly serviceName = 'EmployeeService';

  constructor(private readonly repo: EmployeeRepository) {}

  async list(): Promise<Employee[]> {
    return this.repo.list();
  }

  async getById(id: string): Promise<Employee> {
    const employee = await this.repo.findById(id);
    if (!employee) throw new NotFoundError('Employee', id);
    return employee;
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    if (!input.firstName?.trim()) throw new ValidationError('First name is required');
    if (!input.lastName?.trim()) throw new ValidationError('Last name is required');
    return this.repo.create(input);
  }

  async update(id: string, patch: UpdateEmployeeInput): Promise<Employee> {
    return this.repo.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  /** Checks whether an employee has a specific permission. */
  async checkPermission(employeeId: string, permission: Permission): Promise<boolean> {
    const employee = await this.getById(employeeId);
    return can(employee.role, permission);
  }

  /** Throws PermissionError if the employee lacks the permission. */
  async requirePermission(employeeId: string, permission: Permission): Promise<void> {
    const ok = await this.checkPermission(employeeId, permission);
    if (!ok) throw new PermissionError(permission);
  }
}
