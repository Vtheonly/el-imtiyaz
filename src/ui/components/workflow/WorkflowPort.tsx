import React from 'react';

export const PORT_RADIUS = 8;

interface PortProps {
  label: string;
  portId: string;
  nodeId: string;
  side: 'left' | 'right';
  color: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function WorkflowPort({
  label,
  portId,
  nodeId,
  side,
  color,
  onMouseDown
}: PortProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
        alignItems: 'center',
        gap: 6,
        padding: 0,
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-secondary)',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {side === 'left' && (
        <>
          <div
            data-port={portId}
            data-node-id={nodeId}
            onMouseDown={onMouseDown}
            style={{
              position: 'absolute',
              left: -12 - PORT_RADIUS,
              top: '50%',
              transform: 'translateY(-50%)',
              width: PORT_RADIUS * 2,
              height: PORT_RADIUS * 2,
              borderRadius: '50%',
              background: color,
              border: '2px solid var(--bg-elevated)',
              cursor: 'crosshair',
              boxShadow: `0 0 6px ${color}88`
            }}
          />
          <span style={{ paddingLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
        </>
      )}
      {side === 'right' && (
        <>
          <span style={{ paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          <div
            data-port={portId}
            data-node-id={nodeId}
            onMouseDown={onMouseDown}
            style={{
              position: 'absolute',
              right: -12 - PORT_RADIUS,
              top: '50%',
              transform: 'translateY(-50%)',
              width: PORT_RADIUS * 2,
              height: PORT_RADIUS * 2,
              borderRadius: '50%',
              background: color,
              border: '2px solid var(--bg-elevated)',
              cursor: 'crosshair',
              boxShadow: `0 0 6px ${color}88`
            }}
          />
        </>
      )}
    </div>
  );
}