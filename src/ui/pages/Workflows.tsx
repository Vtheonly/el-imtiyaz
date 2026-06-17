/**
 * Workflows — list & manage automation workflows.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Workflow as WorkflowIcon, Play, Pause, Trash2, Edit, GitBranch } from 'lucide-react';
import { Card, Button, Badge, EmptyState, Modal } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDateTime, relativeTime } from '@shared/currency';

interface WorkflowRow {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  enabled: boolean;
  nodeCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'partial';
  createdAt: string;
}

export function Workflows() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'payment' | 'notification' | 'report' | 'approval' | 'custom'>('payment');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.workflows.list();
      setWorkflows((rows as any[]).map((w) => ({
        id: w.id.value,
        name: w.name,
        description: w.description,
        category: w.category,
        status: w.status,
        version: w.version,
        enabled: w.enabled,
        nodeCount: w.nodes?.length ?? 0,
        lastRunAt: w.lastRunAt,
        lastRunStatus: w.lastRunStatus,
        createdAt: w.createdAt
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const wf = await window.elImtiyaz.workflows.create({ name, description, category });
    setShowCreate(false);
    setName(''); setDescription(''); setCategory('payment');
    navigate(`/workflows/${(wf as any).id.value}/edit`);
  };

  const toggleEnabled = async (wf: WorkflowRow) => {
    if (wf.enabled) await window.elImtiyaz.workflows.disable(wf.id);
    else await window.elImtiyaz.workflows.enable(wf.id);
    load();
  };

  const runNow = async (wf: WorkflowRow) => {
    try {
      await window.elImtiyaz.workflows.run(wf.id);
      load();
    } catch (err) {
      alert(`Run failed: ${(err as Error).message}`);
    }
  };

  const columns: Column<WorkflowRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <WorkflowIcon size={14} style={{ color: 'var(--color-primary-blue)' }} />
          <div>
            <div style={{ fontWeight: 'var(--weight-medium)' }}>{r.name}</div>
            {r.description && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {r.description}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      width: 130,
      render: (r) => <Badge>{r.category}</Badge>
    },
    {
      key: 'nodeCount',
      header: 'Nodes',
      width: 80,
      align: 'center',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.nodeCount}</span>
    },
    {
      key: 'version',
      header: 'Version',
      width: 90,
      render: (r) => <span className="text-mono" style={{ color: 'var(--color-text-tertiary)' }}>v{r.version}</span>
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (r) => (
        <Badge tone={r.status === 'published' ? 'success' : r.status === 'archived' ? 'neutral' : 'warning'}>
          {r.status}
        </Badge>
      )
    },
    {
      key: 'lastRunAt',
      header: 'Last Run',
      width: 180,
      render: (r) => r.lastRunAt ? (
        <div>
          <div style={{ fontSize: 'var(--text-sm)' }}>{relativeTime(r.lastRunAt)}</div>
          {r.lastRunStatus && (
            <Badge tone={r.lastRunStatus === 'success' ? 'success' : r.lastRunStatus === 'partial' ? 'warning' : 'danger'}>
              {r.lastRunStatus}
            </Badge>
          )}
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>Never</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 200,
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Edit size={12} />}
            onClick={() => navigate(`/workflows/${r.id}/edit`)}
          />
          {r.status === 'published' && (
            <Button
              size="sm"
              variant="ghost"
              icon={r.enabled ? <Pause size={12} /> : <Play size={12} />}
              onClick={() => toggleEnabled(r)}
              title={r.enabled ? 'Disable' : 'Enable'}
            />
          )}
          {r.status === 'published' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<GitBranch size={12} />}
              onClick={() => runNow(r)}
              title="Run now"
            >
              Run
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 size={12} />}
            onClick={async () => {
              if (confirm(`Delete workflow "${r.name}"?`)) {
                await window.elImtiyaz.workflows.delete(r.id);
                load();
              }
            }}
          />
        </div>
      )
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Workflows"
        subtitle={`${workflows.length} automation workflows`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            New Workflow
          </Button>
        }
      />

      <Card>
        <DataGrid
          columns={columns}
          data={workflows}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => navigate(`/workflows/${r.id}/edit`)}
          emptyState={
            <EmptyState
              icon={<WorkflowIcon size={24} />}
              title="No workflows yet"
              description="Create your first automation workflow — payment reminders, discount rules, report generation."
            />
          }
        />
      </Card>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Workflow"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Name</label>
            <input
              className="el-input"
              style={{ width: '100%' }}
              placeholder="e.g. Overdue Payment Reminder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Description</label>
            <textarea
              className="el-input"
              style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
              placeholder="What does this workflow do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Category</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                style={{ width: '100%' }}
              >
                <option value="payment">Payment</option>
                <option value="notification">Notification</option>
                <option value="report">Report</option>
                <option value="approval">Approval</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
