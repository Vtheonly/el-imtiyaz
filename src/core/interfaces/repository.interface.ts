/**
 * Repository contract — every persistence implementation must satisfy this.
 * The generic parameter T is the entity type, and TQuery is the filter shape.
 *
 * Repositories are intentionally minimal: they expose CRUD + query only.
 * Business logic lives in services that compose multiple repositories.
 */

export interface IRepository<T, TQuery = any> {
  findById(id: string): Promise<T | null>;
  list(query?: TQuery): Promise<T[]>;
  create(input: Partial<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(query?: TQuery): Promise<number>;
}

/**
 * Pagination helper used by every `list()` that supports it.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  includeDeleted?: boolean;
  [key: string]: any;
}
