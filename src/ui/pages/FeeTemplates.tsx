/**
 * FeeTemplates — manage reusable charge plans and apply to students.
 */

import { useEffect, useState } from 'react';
import { Plus, FileText, Layers, Users, Trash2 } from 'lucide-react';
import { Card, Button, Badge, EmptyState, StatBlock, Modal } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDZD } from '@shared/currency';

interface FeeTemplateRow {
  id: string;
  name: string;
  description?: string;
  gradeLevel: string;
  items: Array<{ type: string; label: string; amount: number; recurrence: string }>;
  isActive: boolean;
}

export function FeeTemplates() {
  const [templates, setTemplates] = useState<FeeTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<Array<{ type: string; label: string; amount: string; recurrence: string }>>([
    { type: 'registration', label: 'Registration', amount: '', recurrence: 'one_time' }
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.feeTemplates.list();
      setTemplates((rows as any[]).map((t) => ({
        id: t.id.value,
        name: t.name,
        description: t.description,
        gradeLevel: t.gradeLevel,
        items: t.items,
        isActive: t.isActive
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim() || !gradeLevel.trim()) return;
    await window.elImtiyaz.feeTemplates.create({
      name,
      gradeLevel,
      description,
      items: items
        .filter((i) => i.label.trim() && i.amount)
        .map((i) => ({
          type: i.type,
          label: i.label,
          amount: parseFloat(i.amount),
          recurrence: i.recurrence as any
        }))
    });
    setShowModal(false);
    setName(''); setGradeLevel(''); setDescription('');
    setItems([{ type: 'registration', label: 'Registration', amount: '', recurrence: 'one_time' }]);
    load();
  };

  const columns: Column<FeeTemplateRow>[] = [
    {
      key: 'name',
      header: 'Template',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: 'var(--color-primary-blue)' }} />
          <div>
            <div style={{ fontWeight: 'var(--weight-medium)' }}>{r.name}</div>
            {r.description && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{r.description}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'gradeLevel',
      header: 'Grade Level',
      width: 140,
      render: (r) => <Badge>{r.gradeLevel}</Badge>
    },
    {
      key: 'items',
      header: 'Items',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.items.map((item, i) => (
            <span
              key={i}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary-tint-08)',
                border: '1px solid var(--border-primary)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-primary-blue)'
              }}
            >
              {item.label}: {formatDZD(item.amount)}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'total',
      header: 'Total',
      width: 140,
      align: 'right',
      render: (r) => (
        <strong style={{ color: 'var(--color-warm-accent)' }}>
          {formatDZD(r.items.reduce((s, i) => s + i.amount, 0))}
        </strong>
      )
    },
    {
      key: 'actions',
      header: '',
      width: 100,
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Users size={12} />} title="Apply to students" />
          <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} />
        </div>
      )
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Fee Templates"
        subtitle={`${templates.length} reusable charge plans`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            New Template
          </Button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Templates" value={templates.length} format="number" icon={<Layers size={18} />} />
        <StatBlock
          label="Total Annual per Template (avg)"
          value={templates.length > 0
            ? Math.round(templates.reduce((s, t) => s + t.items.reduce((sum, i) => sum + i.amount, 0), 0) / templates.length)
            : 0}
          format="currency"
          icon={<FileText size={18} />}
        />
        <StatBlock
          label="Grade Levels"
          value={new Set(templates.map((t) => t.gradeLevel)).size}
          format="number"
          icon={<Users size={18} />}
        />
      </div>

      <Card>
        <DataGrid
          columns={columns}
          data={templates}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<Layers size={24} />} title="No fee templates" description="Create reusable plans for Kindergarten, Primary, High School, etc." />}
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Fee Template"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!name.trim() || !gradeLevel.trim()}>Create</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Name</label>
              <input className="el-input" style={{ width: '100%' }} placeholder="e.g. Kindergarten Plan" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Grade Level</label>
              <input className="el-input" style={{ width: '100%' }} placeholder="e.g. Kindergarten" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Description</label>
            <textarea
              className="el-input"
              style={{ width: '100%', minHeight: 50, resize: 'vertical' }}
              placeholder="What this plan covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="el-stat__label">Fee Items</label>
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={12} />}
                onClick={() => setItems([...items, { type: 'custom', label: '', amount: '', recurrence: 'one_time' }])}
              >
                Add Item
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid" style={{ gridTemplateColumns: '1.5fr 2fr 1fr 1.5fr auto', gap: 'var(--space-2)', alignItems: 'end' }}>
                  <div>
                    <select
                      className="el-input"
                      style={{ width: '100%' }}
                      value={item.type}
                      onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, type: e.target.value } : it))}
                    >
                      <option value="registration">Registration</option>
                      <option value="monthly_tuition">Monthly Tuition</option>
                      <option value="quarterly_tuition">Quarterly Tuition</option>
                      <option value="annual_tuition">Annual Tuition</option>
                      <option value="transportation">Transportation</option>
                      <option value="cafeteria">Cafeteria</option>
                      <option value="uniform">Uniform</option>
                      <option value="books">Books</option>
                      <option value="activities">Activities</option>
                      <option value="exams">Exams</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <input
                    className="el-input"
                    style={{ width: '100%' }}
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, label: e.target.value } : it))}
                  />
                  <input
                    type="number"
                    className="el-input"
                    style={{ width: '100%' }}
                    placeholder="Amount (DZD)"
                    value={item.amount}
                    onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))}
                  />
                  <select
                    className="el-input"
                    style={{ width: '100%' }}
                    value={item.recurrence}
                    onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, recurrence: e.target.value } : it))}
                  >
                    <option value="one_time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={12} />}
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
