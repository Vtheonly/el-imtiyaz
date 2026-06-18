import React from 'react';
import * as Lucide from 'lucide-react';
import { NodeType } from '@core/entities/workflow.entity';
import type { NodeDefinition } from '../../../services/workflow/node-registry';

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  trigger: '#3fa66e',
  condition: '#c8a98c',
  action: '#349bd4',
  delay: '#836c68',
  transform: '#9b6ec1'
};

interface WorkflowPaletteProps {
  nodeRegistry: NodeDefinition[];
  paletteSearch: string;
  onSearchChange: (val: string) => void;
  onDragStart: (e: React.DragEvent, def: NodeDefinition) => void;
}

export function WorkflowPalette({
  nodeRegistry,
  paletteSearch,
  onSearchChange,
  onDragStart
}: WorkflowPaletteProps) {
  const groupedRegistry = nodeRegistry.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, NodeDefinition[]>);

  const filteredRegistry = paletteSearch
    ? Object.fromEntries(
        Object.entries(groupedRegistry).map(([cat, defs]) => [
          cat,
          defs.filter((d) =>
            d.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
            d.description.toLowerCase().includes(paletteSearch.toLowerCase())
          )
        ])
      )
    : groupedRegistry;

  return (
    <div
      style={{
        width: 240,
        borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-panel)',
        overflowY: 'auto',
        flexShrink: 0
      }}
    >
      <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
        <input
          className="el-input"
          style={{ width: '100%' }}
          placeholder="Search nodes…"
          value={paletteSearch}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {Object.entries(filteredRegistry).map(([category, defs]) =>
        defs.length === 0 ? null : (
          <div key={category}>
            <div className="el-nav-section-title">{category}</div>
            {defs.map((def) => {
              const Icon = (Lucide as any)[def.icon] ?? Lucide.Square;
              return (
                <div
                  key={def.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, def)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'grab',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)',
                    borderLeft: `3px solid ${NODE_TYPE_COLORS[def.type]}`,
                    margin: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'all var(--duration-fast) var(--ease-out)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary-tint-08)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <Icon size={14} />
                  <span>{def.label}</span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}