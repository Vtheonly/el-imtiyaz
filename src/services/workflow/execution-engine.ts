/**
 * Workflow Execution Engine — walks the DAG and runs each node in topological order.
 *
 * Algorithm:
 *   1. Validate the graph (no cycles, all edges point to existing nodes)
 *   2. Topologically sort nodes
 *   3. For each node, gather inputs from incoming edges
 *   4. Look up the node definition and call execute()
 *   5. Distribute outputs to downstream edges
 *   6. For conditions, only follow the branch that fired (true/false)
 *   7. Record per-node results for the execution log
 *
 * Failures:
 *   - A node throwing marks itself as 'failed' but does NOT abort the workflow.
 *     Downstream nodes whose inputs depend on a failed node are marked 'skipped'.
 *   - The workflow status becomes 'partial' if some nodes succeeded and some failed.
 */

import type {
  Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, WorkflowNodeResult
} from '../../core/entities/workflow.entity';
import { getNodeDefinition, NodeServices, NodeExecutionContext } from './node-registry';
import { logger } from '../../infrastructure/logger/logger';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowExecutionEngine {
  constructor(private readonly services: NodeServices) {}

  async execute(workflow: Workflow, triggerPayload?: unknown): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId: workflow.id.value,
      workflowVersion: workflow.version,
      startedAt: new Date().toISOString(),
      status: 'running',
      triggerPayload,
      nodeResults: []
    };

    logger.info('workflow.execution.start', {
      workflowId: workflow.id.value,
      version: workflow.version,
      nodeCount: workflow.nodes.length
    });

    try {
      // Validate
      this.validateGraph(workflow);

      // Find trigger nodes (or use the manual trigger)
      const triggerNodes = workflow.nodes.filter((n) => n.type === 'trigger');
      if (triggerNodes.length === 0) {
        throw new Error('Workflow has no trigger node');
      }

      // Topological sort
      const sorted = this.topologicalSort(workflow.nodes, workflow.edges);

      // Per-node output store
      const nodeOutputs = new Map<string, Record<string, unknown>>();

      // Seed trigger outputs with the triggerPayload
      for (const trigger of triggerNodes) {
        nodeOutputs.set(trigger.id, { out: triggerPayload ?? {} });
      }

      // Execute in order
      for (const node of sorted) {
        if (node.type === 'trigger') {
          // Triggers already seeded — record success
          execution.nodeResults.push({
            nodeId: node.id,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            status: 'success',
            output: nodeOutputs.get(node.id)
          });
          continue;
        }

        // Gather inputs from incoming edges
        const inputs: Record<string, unknown> = {};
        const incomingEdges = workflow.edges.filter((e) => e.target === node.id);

        let upstreamFailed = false;
        for (const edge of incomingEdges) {
          const upstreamResult = execution.nodeResults.find((r) => r.nodeId === edge.source);
          if (upstreamResult?.status === 'failed') {
            upstreamFailed = true;
            continue;
          }
          const sourceOutputs = nodeOutputs.get(edge.source);
          if (sourceOutputs) {
            inputs[edge.targetPort] = sourceOutputs[edge.sourcePort];
          }
        }

        if (upstreamFailed) {
          execution.nodeResults.push({
            nodeId: node.id,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            status: 'skipped',
            error: 'Upstream node failed'
          });
          continue;
        }

        // Execute the node
        const result = await this.executeNode(node, inputs);

        execution.nodeResults.push({
          nodeId: node.id,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: result.error ? 'failed' : 'success',
          output: result.outputs,
          error: result.error
        });

        if (result.outputs) {
          nodeOutputs.set(node.id, result.outputs);
        }

        // For conditions: prune downstream edges that don't match the branch
        if (node.type === 'condition' && result.branch) {
          const branchEdges = workflow.edges.filter(
            (e) => e.source === node.id && e.sourcePort !== result.branch
          );
          // Mark targets of non-taken branches as skipped (only if no other input feeds them)
          for (const edge of branchEdges) {
            const otherInputs = workflow.edges.filter(
              (e) => e.target === edge.target && e.source !== node.id
            );
            if (otherInputs.length === 0) {
              execution.nodeResults.push({
                nodeId: edge.target,
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                status: 'skipped',
                error: `Branch ${result.branch} not taken`
              });
            }
          }
        }
      }

      // Determine overall status
      const failed = execution.nodeResults.filter((r) => r.status === 'failed').length;
      const succeeded = execution.nodeResults.filter((r) => r.status === 'success').length;
      execution.status = failed > 0 && succeeded > 0
        ? 'partial'
        : failed > 0 ? 'failed' : 'success';

      execution.finishedAt = new Date().toISOString();
      logger.info('workflow.execution.complete', {
        workflowId: workflow.id.value,
        status: execution.status,
        succeeded,
        failed
      });

      return execution;
    } catch (err) {
      execution.status = 'failed';
      execution.errorMessage = (err as Error).message;
      execution.finishedAt = new Date().toISOString();
      logger.error('workflow.execution.failed', {
        workflowId: workflow.id.value,
        error: (err as Error).message
      });
      return execution;
    }
  }

  private async executeNode(
    node: WorkflowNode,
    inputs: Record<string, unknown>
  ): Promise<{ outputs: Record<string, unknown>; branch?: 'true' | 'false'; error?: string }> {
    const def = getNodeDefinition(node.subtype);
    if (!def) {
      return { outputs: {}, error: `Unknown node subtype: ${node.subtype}` };
    }

    const ctx: NodeExecutionContext = {
      nodeId: node.id,
      config: node.config,
      inputs,
      services: this.services,
      logger: (level, message, meta) => logger.log(level as 'info' | 'warn' | 'error', message, { nodeId: node.id, ...meta })
    };

    try {
      const result = await def.execute(ctx);
      return { outputs: result.outputs, branch: result.branch, error: result.error };
    } catch (err) {
      return { outputs: {}, error: (err as Error).message };
    }
  }

  private validateGraph(workflow: Workflow): void {
    const nodeIds = new Set(workflow.nodes.map((n) => n.id));
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge ${edge.id} references missing source node ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge ${edge.id} references missing target node ${edge.target}`);
      }
    }
    // Cycle detection (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    for (const node of workflow.nodes) inDegree.set(node.id, 0);
    for (const edge of workflow.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    const queue = [...workflow.nodes].filter((n) => (inDegree.get(n.id) ?? 0) === 0);
    let processed = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      processed++;
      for (const edge of workflow.edges.filter((e) => e.source === node.id)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 1) - 1);
        if ((inDegree.get(edge.target) ?? 0) === 0) {
          const target = workflow.nodes.find((n) => n.id === edge.target);
          if (target) queue.push(target);
        }
      }
    }
    if (processed !== workflow.nodes.length) {
      throw new Error('Workflow graph contains a cycle');
    }
  }

  private topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    for (const node of nodes) inDegree.set(node.id, 0);
    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
    const result: WorkflowNode[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const edge of edges.filter((e) => e.source === node.id)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 1) - 1);
        if ((inDegree.get(edge.target) ?? 0) === 0) {
          const target = nodes.find((n) => n.id === edge.target);
          if (target) queue.push(target);
        }
      }
    }
    return result;
  }
}
