/**
 * SmartForm — adaptive form renderer driven by a field schema.
 *
 * Features:
 *   - Renders text, number, select, boolean, date, textarea, json fields
 *   - Conditional visibility (visibleWhen: { field, equals })
 *   - Required field indicators
 *   - Help text under each field
 *   - Live change notifications (no submit button — parent decides when to save)
 *
 * Used by the WorkflowBuilder inspector and any other schema-driven form.
 */

import { ReactNode } from 'react';
import type { NodeConfigField } from '../../../services/workflow/node-registry';

interface SmartFormProps {
  fields: NodeConfigField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Optional custom renderer per field key. */
  renderers?: Record<string, (field: NodeConfigField, value: unknown, onChange: (v: unknown) => void) => ReactNode>;
}

export function SmartForm({ fields, values, onChange, renderers }: SmartFormProps) {
  const visibleFields = fields.filter((field) => {
    if (!field.visibleWhen) return true;
    return values[field.visibleWhen.field] === field.visibleWhen.equals;
  });

  if (visibleFields.length === 0) {
    return (
      <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No configuration needed for this node.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visibleFields.map((field) => {
        const custom = renderers?.[field.key];
        if (custom) {
          return (
            <div key={field.key}>
              <FieldLabel field={field} />
              {custom(field, values[field.key], (v) => onChange(field.key, v))}
              {field.help && <FieldHelp text={field.help} />}
            </div>
          );
        }
        return (
          <div key={field.key}>
            <FieldLabel field={field} />
            <FieldInput
              field={field}
              value={values[field.key]}
              onChange={(v) => onChange(field.key, v)}
            />
            {field.help && <FieldHelp text={field.help} />}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ field }: { field: NodeConfigField }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--color-text-secondary)',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-wide)'
      }}
    >
      {field.label}
      {field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 4 }}>*</span>}
    </label>
  );
}

function FieldHelp({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange
}: {
  field: NodeConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const commonStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
    transition: 'all var(--duration-fast) var(--ease-out)'
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          style={{ ...commonStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'json':
      return (
        <textarea
          style={{ ...commonStyle, minHeight: 80, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
          placeholder={field.placeholder ?? '[]'}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value); // keep raw string until valid JSON
            }
          }}
        />
      );

    case 'select':
      return (
        <div className="el-select" style={{ width: '100%' }}>
          <select
            style={{ ...commonStyle, paddingRight: 32, cursor: 'pointer' }}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            {!value && <option value="">Select…</option>}
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 'var(--text-sm)' }}>{value ? 'Enabled' : 'Disabled'}</span>
        </label>
      );

    case 'number':
      return (
        <input
          type="number"
          style={commonStyle}
          placeholder={field.placeholder}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          style={commonStyle}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'text':
    default:
      return (
        <input
          type="text"
          style={commonStyle}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
