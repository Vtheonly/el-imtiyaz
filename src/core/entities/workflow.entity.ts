/**
 * Workflow entity — node-based automation graph.
 *
 * A workflow is a directed acyclic graph (DAG) of nodes. Each node has:
 *   - A type (trigger, condition, action)
 *   - A subtype (e.g. "payment.overdue", "send.email", "apply.discount")
 *   - A config object (typed per subtype)
 *   - Input/output ports (typed connections)
 *
 * Execution model:
 *   1. Trigger nodes fire when their event occurs (or on schedule)
 *   2. Each downstream node receives a payload from its input edges
 *   3. Conditions branch the execution (true/false outputs)
 *   4. Actions produce side-effects (DB writes, notifications, etc.)
 *
 * Workflows are versioned. Editing a workflow creates a new draft version;
 * the published version stays immutable until explicitly promoted.
 */

import { Identifier } from '../value-objects/identifier';

export type NodeType = 'trigger' | 'condition' | 'action' | 'delay' | 'transform';

export interface WorkflowNodePort {
  id: string;
  label: string;
  type: string;            // payload type, e.g. 'student', 'payment', 'any'
}

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  subtype: string;         // e.g. 'trigger.payment.overdue', 'action.send.email'
  label: string;
  config: Record<string, unknown>;
  position: WorkflowNodePosition;
  inputs: WorkflowNodePort[];
  outputs: WorkflowNodePort[];
}

export interface WorkflowEdge {
  id: string;
  source: string;          // node id
  sourcePort: string;      // port id
  target: string;          // node id
  targetPort: string;      // port id
}

export type WorkflowStatus = 'draft' | 'published' | 'archived';

export interface Workflow {
  id: Identifier<'Workflow'>;
  name: string;
  description?: string;
  category: 'payment' | 'notification' | 'report' | 'approval' | 'custom';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  version: number;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'partial';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  triggerPayload?: unknown;
  nodeResults: WorkflowNodeResult[];
  errorMessage?: string;
}

export interface WorkflowNodeResult {
  nodeId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  category: Workflow['category'];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export type UpdateWorkflowInput = Partial<CreateWorkflowInput> & {
  status?: WorkflowStatus;
  enabled?: boolean;
};
