import React from 'react';
import { Button } from '../common';
import { SmartForm } from '../forms/SmartForm';
import type { WorkflowNode } from '@core/entities/workflow.entity';
import type { NodeDefinition } from '../../../services/workflow/node-registry';

interface WorkflowInspectorProps {
  selectedNode: WorkflowNode | null;
  selectedNodeDef: NodeDefinition | null;
  onConfigChange: (key: string, value: unknown) => void;
  onDeleteNode: (id: string) => void;
}

export function WorkflowInspector({
  selectedNode,
  selectedNodeDef,
  onConfigChange,
  onDeleteNode
}: WorkflowInspectorProps) {
  return (
    <div
      style={{
        width: 320,
        borderLeft: '1px solid var(--border-default)',
        background: 'var(--bg-panel)',
        overflowY: 'auto',
        flexShrink: 0,
        padding: 'var(--space-4)'
      }}
    >
      {selectedNode && selectedNodeDef ? (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div className="el-stat__label">Selected node</div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>
              {selectedNode.label}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {selectedNodeDef.description}
            </div>
          </div>
          <div className="el-divider" />
          <div className="el-stat__label" style={{ marginBottom: 'var(--space-3)' }}>Configuration</div>
          <SmartForm
            fields={selectedNodeDef.configSchema}
            values={selectedNode.config}
            onChange={onConfigChange}
          />
          <div className="el-divider" />
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDeleteNode(selectedNode.id)}
          >
            Delete Node
          </Button>
        </>
      ) : (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <div style={{ marginBottom: 8, fontSize: 'var(--text-sm)' }}>No node selected</div>
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
            Click a node to edit its configuration.
            <br />
            Drag from the palette to add new nodes.
            <br />
            Drag from output ports to input ports to connect.
          </div>
        </div>
      )}
    </div>
  );
}