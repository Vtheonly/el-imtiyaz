/**
 * Workflow repository — SQLite-backed. Stores nodes & edges as JSON columns.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Workflow, CreateWorkflowInput, UpdateWorkflowInput, WorkflowExecution } from '../../core/entities/workflow.entity';
import type { WorkflowStatus } from '../../core/entities/workflow.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  nodes_json: string;
  edges_json: string;
  status: string;
  version: number;
  enabled: number;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  workflow_version: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger_payload_json: string | null;
  node_results_json: string;
  error_message: string | null;
}

export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor(db: DatabaseClient) {
    super(db, 'workflows');
  }

  async findById(id: string): Promise<Workflow | null> {
    const row = this.db.get<WorkflowRow>(
      'SELECT * FROM workflows WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: { category?: string; status?: WorkflowStatus; enabled?: boolean } = {}): Promise<Workflow[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};
    if (query.category) { conditions.push('category = @category'); params.category = query.category; }
    if (query.status) { conditions.push('status = @status'); params.status = query.status; }
    if (query.enabled !== undefined) { conditions.push('enabled = @enabled'); params.enabled = query.enabled ? 1 : 0; }
    const rows = this.db.all<WorkflowRow>(
      `SELECT * FROM workflows WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateWorkflowInput): Promise<Workflow> {
    const id = Identifier.generate<'Workflow'>().value;
    const now = this.now();
    this.db.run(
      `INSERT INTO workflows (id, name, description, category, nodes_json, edges_json, status, version, enabled, created_at, updated_at)
       VALUES (@id, @name, @description, @category, @nodes, @edges, 'draft', 1, 0, @createdAt, @updatedAt)`,
      {
        id,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        nodes: this.stringifyJson(input.nodes ?? []),
        edges: this.stringifyJson(input.edges ?? []),
        createdAt: now,
        updatedAt: now
      }
    );
    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Workflow', id);
    return created;
  }

  async update(id: string, patch: UpdateWorkflowInput): Promise<Workflow> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Workflow', id);

    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.name !== undefined) { sets.push('name = @name'); params.name = patch.name; }
    if (patch.description !== undefined) { sets.push('description = @description'); params.description = patch.description; }
    if (patch.category !== undefined) { sets.push('category = @category'); params.category = patch.category; }
    if (patch.nodes !== undefined) { sets.push('nodes_json = @nodes'); params.nodes = this.stringifyJson(patch.nodes); }
    if (patch.edges !== undefined) { sets.push('edges_json = @edges'); params.edges = this.stringifyJson(patch.edges); }
    if (patch.status !== undefined) { sets.push('status = @status'); params.status = patch.status; }
    if (patch.enabled !== undefined) { sets.push('enabled = @enabled'); params.enabled = patch.enabled ? 1 : 0; }

    this.db.run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = @id`, params);

    // Bump version when nodes/edges change
    if (patch.nodes !== undefined || patch.edges !== undefined) {
      this.db.run('UPDATE workflows SET version = version + 1 WHERE id = ?', [id]);
    }

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Workflow', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run('UPDATE workflows SET deleted_at = @now WHERE id = @id', { id, now: this.now() });
  }

  async recordExecution(execution: WorkflowExecution): Promise<void> {
    this.db.run(
      `INSERT INTO workflow_executions (id, workflow_id, workflow_version, started_at, finished_at, status, trigger_payload_json, node_results_json, error_message)
       VALUES (@id, @workflowId, @version, @startedAt, @finishedAt, @status, @payload, @results, @error)`,
      {
        id: execution.id,
        workflowId: execution.workflowId,
        version: execution.workflowVersion,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt ?? null,
        status: execution.status,
        payload: execution.triggerPayload !== undefined ? JSON.stringify(execution.triggerPayload) : null,
        results: JSON.stringify(execution.nodeResults),
        error: execution.errorMessage ?? null
      }
    );

    // Update workflow's last-run info
    this.db.run(
      `UPDATE workflows SET last_run_at = @at, last_run_status = @status, updated_at = @at WHERE id = @id`,
      { id: execution.workflowId, at: execution.finishedAt ?? new Date().toISOString(), status: execution.status }
    );
  }

  async listExecutions(workflowId: string, limit = 50): Promise<WorkflowExecution[]> {
    const rows = this.db.all<WorkflowExecutionRow>(
      'SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
      [workflowId, limit]
    );
    return rows.map((r) => this.mapExecutionRow(r));
  }

  private mapRow(row: WorkflowRow): Workflow {
    return {
      id: Identifier.from<'Workflow'>(row.id),
      name: row.name,
      description: row.description ?? undefined,
      category: row.category as Workflow['category'],
      nodes: this.parseJson<Workflow['nodes']>(row.nodes_json, []),
      edges: this.parseJson<Workflow['edges']>(row.edges_json, []),
      status: row.status as WorkflowStatus,
      version: row.version,
      enabled: !!row.enabled,
      lastRunAt: row.last_run_at ?? undefined,
      lastRunStatus: row.last_run_status as Workflow['lastRunStatus'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }

  private mapExecutionRow(row: WorkflowExecutionRow): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      status: row.status as WorkflowExecution['status'],
      triggerPayload: row.trigger_payload_json ? JSON.parse(row.trigger_payload_json) : undefined,
      nodeResults: JSON.parse(row.node_results_json),
      errorMessage: row.error_message ?? undefined
    };
  }
}
