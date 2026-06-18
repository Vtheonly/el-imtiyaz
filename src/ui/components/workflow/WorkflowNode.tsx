import React from 'react';
import * as Lucide from 'lucide-react';
import { WorkflowPort } from './WorkflowPort';
import type { WorkflowNode as NodeEntity, NodeType } from '@core/entities/workflow.entity';
import type { NodeDefinition } from '../../../services/workflow/node-registry';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  trigger: '#3fa66e',
  condition: '#c8a98c',
  action: '#349bd4',
  delay: '#836c68',
  transform: '#9b6ec1'
};

interface WorkflowNodeProps {
  node: NodeEntity;
  nodeRegistry: NodeDefinition[];
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, portId: string, portType: 'input' | 'output') => void;
}

export function WorkflowNode({
  node,
  nodeRegistry,
  isSelected,
  onMouseDown,
  onPortMouseDown
}: WorkflowNodeProps) {
  const def = nodeRegistry.find((n) => n.id === node.subtype);
  const Icon = def ? ((Lucide as any)[def.icon] ?? Lucide.Square) : Lucide.Square;
  const color = NODE_TYPE_COLORS[node.type];

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: 'var(--bg-elevated)',
        border: `2px solid ${isSelected ? 'var(--color-primary-blue)' : color}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: isSelected
          ? '0 0 0 4px rgba(52,155,212,0.2), 0 8px 24px rgba(0,0,0,0.4)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        cursor: 'grab',
        transition: 'box-shadow var(--duration-fast) var(--ease-out)',
        zIndex: isSelected ? 10 : 1
      }}
    >
      <div
        style={{
          height: 32,
          padding: '0 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: `${color}22`,
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          boxSizing: 'border-box'
        }}
      >
        <Icon size={14} style={{ color, flexShrink: 0 }} />
        <span style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-semibold)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {node.label}
        </span>
      </div>

      <div style={{ padding: '4px 12px', position: 'relative', boxSizing: 'border-box' }}>
        {Array.from({ length: Math.max(node.inputs.length, node.outputs.length) }).map((_, idx) => {
          const input = node.inputs[idx];
          const output = node.outputs[idx];
          return (
            <div
              key={idx}
              style={{
                height: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                {input && (
                  <WorkflowPort
                    label={input.label}
                    portId={input.id}
                    nodeId={node.id}
                    side="left"
                    color={color}
                    onMouseDown={(e) => onPortMouseDown(e, node.id, input.id, 'input')}
                  />
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                {output && (
                  <WorkflowPort
                    label={output.label}
                    portId={output.id}
                    nodeId={node.id}
                    side="right"
                    color={color}
                    onMouseDown={(e) => onPortMouseDown(e, node.id, output.id, 'output')}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}