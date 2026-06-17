/**
 * WorkflowEditor — drag-and-drop builder for a single workflow.
 *
 * Loads the workflow + node registry, renders the WorkflowBuilder component,
 * and handles save / publish / run via the IPC bridge.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { Button, Badge, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { WorkflowBuilder } from '../components/workflow/WorkflowBuilder';
import { Modal } from '../components/common/Modal';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution } from '@core/entities/workflow.entity';
import { formatDateTime } from '@shared/currency';
import toast from 'react-hot-toast';

export function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodeRegistry, setNodeRegistry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [running, setRunning] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [showExecutions, setShowExecutions] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [wf, reg, execs] = await Promise.all([
        window.elImtiyaz.workflows.get(id),
        window.elImtiyaz.workflows.nodeRegistry(),
        window.elImtiyaz.workflows.executions(id)
      ]);
      setWorkflow(wf as any);
      setNodeRegistry(reg as any[]);
      setExecutions(execs as any[]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleChange = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    setWorkflow((wf) => wf ? { ...wf, nodes, edges } : null);
  }, []);

  const handleSave = async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      await window.elImtiyaz.workflows.update(workflow.id.value, {
        nodes: workflow.nodes,
        edges: workflow.edges,
        name: workflow.name
      });
      toast.success('Workflow saved');
      load();
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!workflow) return;
    setPublishing(true);
    try {
      await window.elImtiyaz.workflows.update(workflow.id.value, {
        nodes: workflow.nodes,
        edges: workflow.edges
      });
      await window.elImtiyaz.workflows.publish(workflow.id.value);
      toast.success('Workflow published');
      load();
    } catch (err) {
      toast.error(`Publish failed: ${(err as Error).message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleRun = async () => {
    if (!workflow) return;
    setRunning(true);
    try {
      const exec = await window.elImtiyaz.workflows.run(workflow.id.value, {}) as any;
      toast.success(`Workflow ${exec.status} (${exec.nodeResults.filter((r: any) => r.status === 'success').length} nodes succeeded)`);
      load();
      setShowExecutions(true);
    } catch (err) {
      toast.error(`Run failed: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading || !workflow) {
    return (
      <div className="el-page">
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="el-spinner el-spinner--lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title={workflow.name}
        subtitle={workflow.description ?? `${workflow.nodes.length} nodes • v${workflow.version}`}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/workflows')}>
              Back
            </Button>
            <Button variant="ghost" icon={<Activity size={14} />} onClick={() => setShowExecutions(true)}>
              History
            </Button>
          </>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <WorkflowBuilder
          workflow={workflow}
          nodeRegistry={nodeRegistry}
          onChange={handleChange}
          onSave={handleSave}
          onPublish={handlePublish}
          onRun={handleRun}
          saving={saving}
          publishing={publishing}
          running={running}
        />
      </div>

      <Modal
        open={showExecutions}
        onClose={() => setShowExecutions(false)}
        title="Execution History"
        size="lg"
      >
        {executions.length === 0 ? (
          <EmptyState title="No executions yet" description="Run the workflow to see results here." />
        ) : (
          <div className="flex flex-col gap-2">
            {executions.map((exec) => (
              <div
                key={exec.id}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <div className="flex items-center gap-2">
                    <Badge tone={exec.status === 'success' ? 'success' : exec.status === 'partial' ? 'warning' : 'danger'}>
                      {exec.status}
                    </Badge>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(exec.startedAt)}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    v{exec.workflowVersion}
                  </span>
                </div>
                {exec.errorMessage && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 4 }}>
                    {exec.errorMessage}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 'var(--text-xs)' }}>
                  {exec.nodeResults.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        margin: 2,
                        borderRadius: 'var(--radius-sm)',
                        background: r.status === 'success'
                          ? 'rgba(63,166,110,0.15)'
                          : r.status === 'failed'
                            ? 'rgba(192,80,77,0.15)'
                            : 'rgba(255,255,255,0.05)',
                        color: r.status === 'success'
                          ? 'var(--color-success)'
                          : r.status === 'failed'
                            ? 'var(--color-danger)'
                            : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {r.nodeId.slice(0, 12)}: {r.status}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
