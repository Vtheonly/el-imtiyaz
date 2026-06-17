/**
 * Base repository — shared SQL helpers used by every concrete repository.
 * Reduces duplication for pagination, JSON column parsing, and soft-delete.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { PageQuery, Paginated } from '../../core/interfaces/repository.interface';

export abstract class BaseRepository<T, TQuery extends PageQuery = PageQuery> {
  constructor(
    protected readonly db: DatabaseClient,
    protected readonly tableName: string
  ) {}

  /** Direct access to the underlying DatabaseClient for SQL that doesn't fit the CRUD pattern. */
  get raw(): DatabaseClient {
    return this.db;
  }

  abstract findById(id: string): Promise<T | null>;
  abstract list(query?: TQuery): Promise<T[]>;
  abstract create(input: Partial<T>): Promise<T>;
  abstract update(id: string, patch: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;

  count(query?: TQuery): Promise<number> {
    const where = this.buildWhereClause(query);
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${where.sql}`,
      where.params
    );
    return Promise.resolve(row?.count ?? 0);
  }

  protected paginate<R>(items: R[], query: PageQuery = {}): Paginated<R> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    return {
      items,
      total: items.length,
      page,
      pageSize,
      hasMore: items.length === pageSize
    };
  }

  protected buildWhereClause(
    query?: PageQuery,
    customFilters: Array<{ field: string; op: string; value: unknown }> = []
  ): { sql: string; params: Record<string, unknown> } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (!query?.includeDeleted) {
      conditions.push(`${this.tableName}.deleted_at IS NULL`);
    }

    if (query?.search) {
      conditions.push(`(${this.searchColumns().map((c) => `${c} LIKE @search`).join(' OR ')})`);
      params.search = `%${query.search}%`;
    }

    for (const filter of customFilters) {
      if (filter.value !== undefined && filter.value !== null) {
        const paramName = filter.field.replace(/\./g, '_');
        conditions.push(`${filter.field} ${filter.op} @${paramName}`);
        params[paramName] = filter.value;
      }
    }

    const sql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql, params };
  }

  protected buildOrderBy(query?: PageQuery, defaultSort = 'created_at'): string {
    if (!query?.sortBy) return `ORDER BY ${defaultSort} DESC`;
    const dir = query.sortDir === 'asc' ? 'ASC' : 'DESC';
    return `ORDER BY ${query.sortBy} ${dir}`;
  }

  /** Override in subclasses to specify which columns the search term matches. */
  protected searchColumns(): string[] {
    return ['full_name'];
  }

  protected now(): string {
    return new Date().toISOString();
  }

  protected parseJson<T = unknown>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  protected stringifyJson(value: unknown): string {
    return JSON.stringify(value);
  }
}
