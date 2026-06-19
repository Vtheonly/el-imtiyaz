/**
 * FeeTemplates — manage reusable charge plans and apply to students.
 *
 * Extended (2026-06) with three Excel-migration features at the top of
 * the page (no new tabs):
 *   1. "Import from Excel" — opens a modal that calls the Excel ingestion
 *      service to analyze a workbook and (optionally) import its master
 *      ledger sheet.
 *   2. "Fee Schedules" — toggles a panel that shows the editable pricing
 *      tiers (registration, tuition, transport, etc.) which mirror the
 *      implicit constants inside the Excel formulas (=25000+205000+35000-J2).
 *   3. "New Quote Block" — opens a modal for building a Devis-style quote
 *      block with per-line totals, sub-total, net payable, and 5% tax
 *      on school fees — reproducing the Excel Devis sheet block behaviour.
 */

import { useEffect, useState } from 'react';
import { Plus, FileText, Layers, Users, Trash2, FileSpreadsheet, Calendar, Sigma, RefreshCw } from 'lucide-react';
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

  // Excel-migration UI state (added 2026-06)
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<any | null>(null);
  const [importFilePath, setImportFilePath] = useState('');
  const [importStatus, setImportStatus] = useState<{ step: string; result?: any; error?: string } | null>(null);

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

  // Load the active fee schedule (Excel pricing tiers).
  useEffect(() => {
    window.elImtiyaz.feeSchedules.list({ isActive: true }).then((rows) => {
      const arr = rows as any[];
      if (arr.length > 0) setActiveSchedule(arr[0]);
    }).catch(() => {/* no schedule yet — that's OK */});
  }, []);

  // Import a spreadsheet: analyze → import ledger → import comments.
  const handleImport = async () => {
    if (!importFilePath.trim()) return;
    setImportStatus({ step: 'Analyzing workbook…' });
    try {
      const analysis = await window.elImtiyaz.spreadsheets.analyze(importFilePath);
      setImportStatus({ step: `Analyzed ${(analysis as any).sheetCount} sheets, ${(analysis as any).formulaCount} formulas. Importing ledger…` });

      // Find the sheet that looks like the ETAT ledger (most rows).
      const template = (analysis as any).template;
      const ledgerSheet = template?.sheets?.find((s: any) =>
        s.headers?.some((h: any) => h.label?.toUpperCase().includes('NOM'))
      ) ?? template?.sheets?.[0];

      if (ledgerSheet) {
        const importResult = await window.elImtiyaz.spreadsheets.importLedger(
          importFilePath,
          ledgerSheet.name
        );
        setImportStatus({ step: 'Importing audit comments…', result: importResult });
        await window.elImtiyaz.spreadsheets.importComments(importFilePath, ledgerSheet.name);
        setImportStatus({
          step: 'Done!',
          result: {
            ...(importResult as any),
            template: { name: template?.name, sheets: template?.sheets?.length },
          },
        });
      } else {
        setImportStatus({ step: 'No suitable sheet found for ledger import.', result: analysis });
      }
    } catch (err) {
      setImportStatus({ step: 'Failed', error: (err as Error).message });
    }
  };

  const handleSeedFormulas = async () => {
    try {
      const result = await window.elImtiyaz.formulaRules.seedStarters();
      alert(`Seeded ${(result as any).seeded} starter formula rules.`);
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`);
    }
  };

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
          <>
            {/* Excel-migration controls (added 2026-06). No new tabs — all live here. */}
            <Button
              variant="ghost"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => setShowImportModal(true)}
              title="Import a Suivis clients.xlsx-style workbook"
            >
              Import from Excel
            </Button>
            <Button
              variant="ghost"
              icon={<Layers size={14} />}
              onClick={() => setShowScheduleModal(true)}
              title="Edit the school's pricing tiers (registration, tuition, transport…)"
            >
              Fee Schedule
            </Button>
            <Button
              variant="ghost"
              icon={<FileText size={14} />}
              onClick={() => setShowQuoteModal(true)}
              title="Build a Devis-style quote block"
            >
              New Quote Block
            </Button>
            <Button
              variant="ghost"
              icon={<Sigma size={14} />}
              onClick={() => setShowFormulaModal(true)}
              title="Manage calculation rules (Excel-style formulas)"
            >
              Formula Library
            </Button>
            <Button
              variant="ghost"
              icon={<RefreshCw size={14} />}
              onClick={handleSeedFormulas}
              title="Seed starter formula rules from the Excel workbook"
            />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
              New Template
            </Button>
          </>
        }
      />

      {/* Active fee schedule summary (compact, at-a-glance) */}
      {activeSchedule && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Card>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div className="flex items-center gap-2">
                <Layers size={14} style={{ color: 'var(--color-primary-blue)' }} />
                <strong>Active Fee Schedule:</strong> <span>{activeSchedule.name}</span>
                <Badge>{activeSchedule.gradeLevel}</Badge>
              </div>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                {activeSchedule.lines?.slice(0, 6).map((line: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-primary-tint-08)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-primary-blue)',
                    }}
                  >
                    {line.label}: {formatDZD(line.amount)}
                  </span>
                ))}
                {activeSchedule.lines?.length > 6 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    +{activeSchedule.lines.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

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

      {/* ── Import from Excel modal (added 2026-06) ── */}
      <ImportFromExcelModal
        open={showImportModal}
        onClose={() => { setShowImportModal(false); setImportStatus(null); setImportFilePath(''); }}
        filePath={importFilePath}
        setFilePath={setImportFilePath}
        onImport={handleImport}
        status={importStatus}
      />

      {/* ── Fee Schedule modal (added 2026-06) ── */}
      <FeeScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        active={activeSchedule}
        onSaved={async () => {
          const rows = await window.elImtiyaz.feeSchedules.list({ isActive: true });
          const arr = rows as any[];
          if (arr.length > 0) setActiveSchedule(arr[0]);
          setShowScheduleModal(false);
        }}
      />

      {/* ── New Quote Block modal (added 2026-06) ── */}
      <NewQuoteBlockModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        onSaved={() => setShowQuoteModal(false)}
      />

      {/* ── Formula Library modal (added 2026-06) ── */}
      <FormulaLibraryModal
        open={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Excel-migration sub-modals (added 2026-06). Kept in the same file to
// avoid creating new tabs/pages — these are sub-components of FeeTemplates.
// ══════════════════════════════════════════════════════════════════════════

function ImportFromExcelModal({
  open, onClose, filePath, setFilePath, onImport, status,
}: {
  open: boolean;
  onClose: () => void;
  filePath: string;
  setFilePath: (v: string) => void;
  onImport: () => void;
  status: { step: string; result?: any; error?: string } | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Import from Excel" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={onImport} disabled={!filePath.trim()}>
            Analyze & Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>
            Workbook file path
          </label>
          <input
            className="el-input"
            style={{ width: '100%' }}
            placeholder="/path/to/Suivis clients.xlsx"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
          />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 6 }}>
            The workbook will be analyzed (sheets, formulas, validations, named ranges) and the
            master ledger sheet will be imported row-by-row into the in-app ledger. Column AM
            audit comments are also imported.
          </p>
        </div>

        {status && (
          <div className="el-card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2, #2a2b2c)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)', marginBottom: 6 }}>{status.step}</div>
            {status.result && (
              <pre style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {JSON.stringify(status.result, null, 2)}
              </pre>
            )}
            {status.error && (
              <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                {status.error}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function FeeScheduleModal({
  open, onClose, active, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  active: any | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(active?.name ?? 'Default (Excel 2026-2027)');
  const [gradeLevel, setGradeLevel] = useState(active?.gradeLevel ?? 'ALL');
  const [lines, setLines] = useState<Array<{ type: string; label: string; amount: string; includedInQuote: boolean; isInstallment: boolean; excelColumn?: string }>>(
    active?.lines?.map((l: any) => ({
      type: l.type,
      label: l.label,
      amount: String(l.amount),
      includedInQuote: l.includedInQuote,
      isInstallment: l.isInstallment,
      excelColumn: l.excelColumn,
    })) ?? [
      { type: 'registration', label: 'Registration Fee', amount: '25000', includedInQuote: true, isInstallment: true, excelColumn: 'R' },
      { type: 'tuition', label: 'Base Tuition', amount: '205000', includedInQuote: true, isInstallment: false, excelColumn: 'L' },
      { type: 'transport_base', label: 'Transport (standard)', amount: '35000', includedInQuote: true, isInstallment: false, excelColumn: 'L' },
      { type: 'transport_premium', label: 'Transport (premium)', amount: '55000', includedInQuote: true, isInstallment: false, excelColumn: 'L' },
      { type: 'transport_t1', label: 'Transport T1', amount: '30000', includedInQuote: false, isInstallment: true, excelColumn: 'W' },
      { type: 'transport_t2', label: 'Transport T2', amount: '15000', includedInQuote: false, isInstallment: true, excelColumn: 'X' },
      { type: 'transport_t3', label: 'Transport T3', amount: '10000', includedInQuote: false, isInstallment: true, excelColumn: 'Y' },
    ]
  );
  const [saving, setSaving] = useState(false);

  // Re-sync when active schedule changes.
  useEffect(() => {
    if (active) {
      setName(active.name);
      setGradeLevel(active.gradeLevel);
      setLines(active.lines?.map((l: any) => ({
        type: l.type, label: l.label, amount: String(l.amount),
        includedInQuote: l.includedInQuote, isInstallment: l.isInstallment, excelColumn: l.excelColumn,
      })));
    }
  }, [active]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        gradeLevel,
        lines: lines.map((l) => ({
          type: l.type, label: l.label, amount: parseFloat(l.amount) || 0,
          includedInQuote: l.includedInQuote, isInstallment: l.isInstallment, excelColumn: l.excelColumn,
        })),
        isActive: true,
      };
      if (active?.id?.value) {
        await window.elImtiyaz.feeSchedules.update(active.id.value, payload);
      } else {
        await window.elImtiyaz.feeSchedules.create(payload);
      }
      onSaved();
    } catch (err) {
      alert(`Failed to save schedule: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Fee Schedule (Excel pricing tiers)" size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Recompute Ledger'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          These tiers replace the implicit constants inside Excel formulas
          (e.g. <code>=25000+205000+35000-J2</code>). Editing them automatically
          recomputes every ledger entry's DEVIS ANNUEL.
        </p>
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Schedule name</label>
            <input className="el-input" style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Grade level</label>
            <input className="el-input" style={{ width: '100%' }} value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="el-stat__label">Fee lines</label>
            <Button
              size="sm" variant="ghost" icon={<Plus size={12} />}
              onClick={() => setLines([...lines, { type: 'custom', label: '', amount: '', includedInQuote: false, isInstallment: false }])}
            >
              Add Line
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid" style={{ gridTemplateColumns: '1.2fr 2fr 1fr 0.7fr 0.7fr 0.6fr auto', gap: 'var(--space-2)', alignItems: 'end' }}>
                <select
                  className="el-input" style={{ width: '100%' }}
                  value={line.type}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, type: e.target.value } : l))}
                >
                  <option value="registration">registration</option>
                  <option value="tuition">tuition</option>
                  <option value="transport_base">transport_base</option>
                  <option value="transport_premium">transport_premium</option>
                  <option value="transport_t1">transport_t1</option>
                  <option value="transport_t2">transport_t2</option>
                  <option value="transport_t3">transport_t3</option>
                  <option value="psy">psy</option>
                  <option value="orth">orth</option>
                  <option value="extras">extras</option>
                  <option value="ratrapage">ratrapage</option>
                  <option value="custom">custom</option>
                </select>
                <input className="el-input" style={{ width: '100%' }} placeholder="Label" value={line.label}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, label: e.target.value } : l))} />
                <input type="number" className="el-input" style={{ width: '100%' }} placeholder="Amount (DZD)" value={line.amount}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))} />
                <label style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={line.includedInQuote}
                    onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, includedInQuote: e.target.checked } : l))} />
                  In Quote
                </label>
                <label style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={line.isInstallment}
                    onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, isInstallment: e.target.checked } : l))} />
                  Installment
                </label>
                <input className="el-input" style={{ width: '100%' }} placeholder="Col" value={line.excelColumn ?? ''}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, excelColumn: e.target.value } : l))} />
                <Button size="sm" variant="ghost" icon={<Trash2 size={12} />}
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NewQuoteBlockModal({
  open, onClose, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [advances, setAdvances] = useState('0');
  const [discounts, setDiscounts] = useState('0');
  const [items, setItems] = useState<Array<{ label: string; amounts: string[] }>>([
    { label: 'Line item 1', amounts: ['0', '0', '0', '0', '0', '0', '0', '0'] },
  ]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.elImtiyaz.quotes.create({
        name,
        studentId: studentId || undefined,
        advances: parseFloat(advances) || 0,
        discounts: parseFloat(discounts) || 0,
        items: items.map((it) => ({
          label: it.label,
          amounts: it.amounts.map((a) => parseFloat(a) || 0),
        })),
      });
      // Reset
      setName(''); setStudentId(''); setAdvances('0'); setDiscounts('0');
      setItems([{ label: 'Line item 1', amounts: ['0', '0', '0', '0', '0', '0', '0', '0'] }]);
      onSaved();
    } catch (err) {
      alert(`Failed to create quote: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const subTotal = items.reduce(
    (s, it) => s + it.amounts.reduce((ss, a) => ss + (parseFloat(a) || 0), 0),
    0
  );
  const schoolFeeSum = items.reduce((s, it) => s + (parseFloat(it.amounts[5]) || 0), 0);
  const netPayable = subTotal - (parseFloat(advances) || 0) - (parseFloat(discounts) || 0);
  const schoolFeeTax = schoolFeeSum * 0.05;

  return (
    <Modal open={open} onClose={onClose} title="New Quote Block (Devis)" size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Create Quote Block'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          Reproduces one block of the Excel <code>Devis</code> sheet. Per-line totals
          (<code>=SUM(A:H)</code>), sub-total, net payable, and 5% tax on school fees
          (<code>=SUM(F)*0.05</code>) are all computed automatically.
        </p>

        <div className="grid" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Quote name</label>
            <input className="el-input" style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Student ID (optional)</label>
            <input className="el-input" style={{ width: '100%' }} value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Advances</label>
            <input type="number" className="el-input" style={{ width: '100%' }} value={advances} onChange={(e) => setAdvances(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Discounts</label>
            <input type="number" className="el-input" style={{ width: '100%' }} value={discounts} onChange={(e) => setDiscounts(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="el-stat__label">Line items (8 amount columns A..H, F = school fee)</label>
            <Button size="sm" variant="ghost" icon={<Plus size={12} />}
              onClick={() => setItems([...items, { label: `Line item ${items.length + 1}`, amounts: ['0', '0', '0', '0', '0', '0', '0', '0'] }])}>
              Add Line
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                <input className="el-input" style={{ flex: 1, minWidth: 180 }} placeholder="Label" value={it.label}
                  onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                {it.amounts.map((amt, ci) => (
                  <input key={ci} type="number" className="el-input" style={{ width: 70 }}
                    value={amt} placeholder={ci === 5 ? 'F (fee)' : String.fromCharCode(65 + ci)}
                    title={`Column ${String.fromCharCode(65 + ci)}`}
                    onChange={(e) => setItems(items.map((x, i) => i === idx
                      ? { ...x, amounts: x.amounts.map((a, j) => j === ci ? e.target.value : a) }
                      : x
                    ))} />
                ))}
                <span style={{ fontWeight: 'var(--weight-semibold)', minWidth: 100, textAlign: 'right', color: 'var(--color-success)' }}>
                  {formatDZD(it.amounts.reduce((s, a) => s + (parseFloat(a) || 0), 0))}
                </span>
                <Button size="sm" variant="ghost" icon={<Trash2 size={12} />}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          <StatBlock label="Sub-total (=SUM(line totals))" value={subTotal} format="currency" />
          <StatBlock label="Net Payable (=sub - adv - disc)" value={netPayable} format="currency" />
          <StatBlock label="5% Tax on School Fees (=SUM(F)*0.05)" value={schoolFeeTax} format="currency" />
        </div>
      </div>
    </Modal>
  );
}

function FormulaLibraryModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [testExpression, setTestExpression] = useState('');
  const [testContext, setTestContext] = useState('{\n  "fields": {\n    "fi": 25000,\n    "v2": 71500,\n    "altV2": 0,\n    "v3": 71500,\n    "t1": 30000,\n    "t2": 15000,\n    "t3": 10000\n  }\n}');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.formulaRules.list();
      setRules(rows as any[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ctx = JSON.parse(testContext);
      const result = await window.elImtiyaz.formulaRules.test(testExpression, ctx);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async (rule: any) => {
    try {
      await window.elImtiyaz.formulaRules.update(rule.id.value, { isActive: !rule.isActive });
      load();
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`);
    }
  };

  const handleSelect = (rule: any) => {
    setSelectedRule(rule);
    setTestExpression(rule.expression);
  };

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', width: 200, sortable: true,
      render: (r) => <strong>{r.name}</strong> },
    { key: 'scope', header: 'Scope', width: 100,
      render: (r) => <Badge>{r.scope}</Badge> },
    { key: 'expression', header: 'Expression',
      render: (r) => <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{r.expression}</code> },
    { key: 'targetField', header: 'Target', width: 140,
      render: (r) => r.targetField ?? '—' },
    { key: 'isActive', header: 'Active', width: 80,
      render: (r) => <Badge color={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'ON' : 'OFF'}</Badge> },
    { key: 'actions', header: '', width: 130,
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => handleSelect(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleToggleActive(r)}>
            {r.isActive ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ) },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Formula Library (Excel-style rules)" size="xl"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          Each rule reproduces an Excel cell formula. Rules with <code>trigger: on_save</code> auto-evaluate
          when their target entity changes. Use the test panel below to evaluate any expression against
          a custom context.
        </p>

        <Card>
          <DataGrid
            columns={columns}
            data={rules}
            rowKey={(r) => r.id?.value ?? r.id}
            loading={loading}
            emptyState={
              <EmptyState
                icon={<Sigma size={24} />}
                title="No formula rules yet"
                description="Click the refresh button on the Fee Templates page to seed starter rules from the Excel workbook."
              />
            }
          />
        </Card>

        {/* Test panel */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Card>
            <div style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>
              Test an expression
            </div>
            <div className="flex flex-col gap-2">
              <input
                className="el-input"
                style={{ width: '100%' }}
                placeholder="fi + v2 + altV2 + v3 + t1 + t2 + t3"
                value={testExpression}
                onChange={(e) => setTestExpression(e.target.value)}
              />
              <textarea
                className="el-input"
                style={{ width: '100%', minHeight: 100, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}
                value={testContext}
                onChange={(e) => setTestContext(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleTest} disabled={testing || !testExpression.trim()}>
                  {testing ? 'Evaluating…' : 'Evaluate'}
                </Button>
                {testResult && (
                  <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                    {testResult.ok ? (
                      <span style={{ color: 'var(--color-success)' }}>
                        ✓ Result: {JSON.stringify(testResult.value)} (in {testResult.durationMs}ms)
                        {testResult.fieldRefs && <> · Refs: {testResult.fieldRefs.join(', ')}</>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-danger)' }}>✗ {testResult.error}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
}
