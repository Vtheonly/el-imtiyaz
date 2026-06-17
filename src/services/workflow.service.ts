/**
 * Workflow service — orchestrates CRUD, validation, and execution.
 *
 * Wires the NodeServices dependencies into the execution engine. The engine
 * never imports services directly — it goes through this injection point so
 * tests can substitute mocks.
 */

import { WorkflowRepository } from '../infrastructure/repositories/workflow.repository';
import { WorkflowExecutionEngine } from './workflow/execution-engine';
import type { Workflow, CreateWorkflowInput, UpdateWorkflowInput, WorkflowExecution } from '../core/entities/workflow.entity';
import type { NodeServices } from './workflow/node-registry';
import { logger } from '../infrastructure/logger/logger';
import { NotFoundError, ValidationError, BusinessRuleError } from '../infrastructure/error/app-error';

export class WorkflowService {
  readonly serviceName = 'WorkflowService';
  private readonly engine: WorkflowExecutionEngine;

  constructor(
    private readonly repo: WorkflowRepository,
    nodeServices: NodeServices
  ) {
    this.engine = new WorkflowExecutionEngine(nodeServices);
  }

  async list(query: { category?: string; status?: Workflow['status']; enabled?: boolean } = {}): Promise<Workflow[]> {
    return this.repo.list(query);
  }

  async getById(id: string): Promise<Workflow> {
    const wf = await this.repo.findById(id);
    if (!wf) throw new NotFoundError('Workflow', id);
    return wf;
  }

  async create(input: CreateWorkflowInput): Promise<Workflow> {
    if (!input.name?.trim()) throw new ValidationError('Workflow name is required');
    if (!input.category) throw new ValidationError('Category is required');
    return this.repo.create(input);
  }

  async update(id: string, patch: UpdateWorkflowInput): Promise<Workflow> {
    const existing = await this.getById(id);
    if (existing.status === 'published' && (patch.nodes || patch.edges)) {
      throw new BusinessRuleError('Cannot edit a published workflow — create a new version instead');
    }
    return this.repo.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  async publish(id: string): Promise<Workflow> {
    const wf = await this.getById(id);
    if (wf.nodes.length === 0) {
      throw new BusinessRuleError('Cannot publish a workflow with no nodes');
    }
    if (!wf.nodes.some((n) => n.type === 'trigger')) {
      throw new BusinessRuleError('Workflow must have at least one trigger node');
    }
    return this.repo.update(id, { status: 'published', enabled: true });
  }

  async enable(id: string): Promise<Workflow> {
    return this.repo.update(id, { enabled: true });
  }

  async disable(id: string): Promise<Workflow> {
    return this.repo.update(id, { enabled: false });
  }

  async run(id: string, triggerPayload?: unknown): Promise<WorkflowExecution> {
    const wf = await this.getById(id);
    if (wf.status !== 'published') {
      throw new BusinessRuleError('Workflow must be published before running');
    }
    logger.info('workflow.run.requested', { workflowId: id, version: wf.version });
    const execution = await this.engine.execute(wf, triggerPayload);
    await this.repo.recordExecution(execution);
    return execution;
  }

  async listExecutions(id: string): Promise<WorkflowExecution[]> {
    return this.repo.listExecutions(id);
  }
}
