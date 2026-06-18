/**
 * WorkflowBuilder — drag-and-drop node graph editor.
 *
 * Orchestration hub that composes the palette, canvas, and inspector.
 * Node rendering, port rendering, palette, and inspector are extracted
 * into separate components.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Badge, Button, Modal } from '../common';
import { WorkflowPalette } from './WorkflowPalette';
import { WorkflowInspector } from './WorkflowInspector';
import { WorkflowNode } from './WorkflowNode';
import type { Workflow, WorkflowNode as NodeEntity, WorkflowEdge } from '@core/entities/workflow.entity';
import type { NodeDefinition } from '../../../services/workflow/node-registry';

interface Point { x: number; y: number; }

interface DragState {
  type: 'node' | 'edge' | 'pan';
  nodeId?: string;
  fromPort?: { nodeId: string; portId: string; portType: 'input' | 'output' };
  startPos: Point;
  currentPos: Point;
  offset?: Point;
}

const NODE_WIDTH = 200;

interface WorkflowBuilderProps {
  workflow: Workflow;
  nodeRegistry: NodeDefinition[];
  onChange: (nodes: NodeEntity[], edges: WorkflowEdge[]) => void;
  onSave: () => void;
  onPublish: () => void;
  onRun: () => void;
  saving?: boolean;
  publishing?: boolean;
  running?: boolean;
}

export function WorkflowBuilder({
  workflow,
  nodeRegistry,
  onChange,
  onSave,
  onPublish,
  onRun,
  saving,
  publishing,
  running
}: WorkflowBuilderProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  const nodes = workflow.nodes;
  const edges = workflow.edges;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedNodeDef: NodeDefinition | null = selectedNode
    ? (nodeRegistry.find((n) => n.id === selectedNode.subtype) ?? null)
    : null;

  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  const getPortPosition = (nodeId: string, portId: string, portType: 'input' | 'output'): Point | null => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const ports = portType === 'input' ? node.inputs : node.outputs;
    const idx = ports.findIndex((p) => p.id === portId);
    if (idx === -1) return null;
    return {
      x: node.position.x + (portType === 'input' ? 0 : NODE_WIDTH),
      y: node.position.y + 32 + 4 + (idx + 0.5) * 20
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setDrag({
        type: 'pan',
        startPos: { x: e.clientX, y: e.clientY },
        currentPos: { x: e.clientX, y: e.clientY }
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } else if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('wf-canvas-bg')) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: NodeEntity) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDrag({
      type: 'node',
      nodeId: node.id,
      startPos: canvasPos,
      currentPos: canvasPos,
      offset: { x: canvasPos.x - node.position.x, y: canvasPos.y - node.position.y }
    });
  };

  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, portId: string, portType: 'input' | 'output') => {
    e.stopPropagation();
    if (portType !== 'output') return;
    const pos = getPortPosition(nodeId, portId, 'output');
    if (!pos) return;
    setDrag({
      type: 'edge',
      fromPort: { nodeId, portId, portType },
      startPos: pos,
      currentPos: pos
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    if (drag.type === 'pan') {
      const dx = e.clientX - drag.currentPos.x;
      const dy = e.clientY - drag.currentPos.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      setDrag({ ...drag, currentPos: { x: e.clientX, y: e.clientY } });
    } else if (drag.type === 'node' && drag.nodeId && drag.offset) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const updatedNodes = nodes.map((n) =>
        n.id === drag.nodeId
          ? { ...n, position: { x: pos.x - drag.offset!.x, y: pos.y - drag.offset!.y } }
          : n
      );
      onChange(updatedNodes, edges);
    } else if (drag.type === 'edge') {
      setDrag({ ...drag, currentPos: screenToCanvas(e.clientX, e.clientY) });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drag) return;
    if (drag.type === 'edge' && drag.fromPort) {
      const target = (e.target as HTMLElement).dataset.port;
      const targetNode = (e.target as HTMLElement).dataset.nodeId;
      if (target && targetNode && drag.fromPort.nodeId !== targetNode) {
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: drag.fromPort.nodeId,
          sourcePort: drag.fromPort.portId,
          target: targetNode,
          targetPort: target
        };
        const exists = edges.some(
          (edge) => edge.source === newEdge.source && edge.sourcePort === newEdge.sourcePort && edge.target === newEdge.target && edge.targetPort === newEdge.targetPort
        );
        if (!exists) {
          onChange(nodes, [...edges, newEdge]);
        }
      }
    }
    setDrag(null);
  };

  const handlePaletteDragStart = (e: React.DragEvent, def: NodeDefinition) => {
    e.dataTransfer.setData('application/node-subtype', def.id);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const subtype = e.dataTransfer.getData('application/node-subtype');
    if (!subtype) return;
    const def = nodeRegistry.find((n) => n.id === subtype);
    if (!def) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    const newNode: NodeEntity = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      subtype: def.id,
      label: def.label,
      config: def.configSchema.reduce((acc, f) => {
        if (f.default !== undefined) acc[f.key] = f.default;
        return acc;
      }, {} as Record<string, unknown>),
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - 40 },
      inputs: def.inputs.map((p) => ({ ...p })),
      outputs: def.outputs.map((p) => ({ ...p }))
    };
    onChange([...nodes, newNode], edges);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (selectedNodeId) {
          onChange(
            nodes.filter((n) => n.id !== selectedNodeId),
            edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)
          );
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          onChange(nodes, edges.filter((edge) => edge.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, onChange]);

  const handleConfigChange = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    const updatedNodes = nodes.map((n) =>
      n.id === selectedNodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    );
    onChange(updatedNodes, edges);
  };

  const handleDeleteNode = (nodeId: string) => {
    onChange(
      nodes.filter((n) => n.id !== nodeId),
      edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    setSelectedNodeId(null);
  };

  return (
    <div className="flex h-full" style={{ overflow: 'hidden' }}>
      <WorkflowPalette
        nodeRegistry={nodeRegistry}
        paletteSearch={paletteSearch}
        onSearchChange={setPaletteSearch}
        onDragStart={handlePaletteDragStart}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-panel)' }}>
          <div className="flex items-center gap-3">
            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{workflow.name}</div>
            <Badge tone={workflow.status === 'published' ? 'success' : 'neutral'}>{workflow.status} • v{workflow.version}</Badge>
            {workflow.enabled && <Badge tone="success" dot>Enabled</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowHelp(true)}>Help</Button>
            <Button size="sm" variant="ghost" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
            <Button size="sm" variant="ghost" onClick={onPublish} disabled={publishing || workflow.status === 'published'}>{publishing ? 'Publishing…' : 'Publish'}</Button>
            <Button size="sm" variant="primary" onClick={onRun} disabled={running || workflow.status !== 'published'}>{running ? 'Running…' : 'Run Now'}</Button>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="wf-canvas-bg"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(circle at center, #2a2b2d 0%, var(--color-dark-bg) 70%)`,
            backgroundSize: '24px 24px, 100% 100%'
          }}
        >
          <div style={{ position: 'absolute', left: pan.x, top: pan.y, transform: `scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width="100%" height="100%">
              {edges.map((edge) => {
                const from = getPortPosition(edge.source, edge.sourcePort, 'output');
                const to = getPortPosition(edge.target, edge.targetPort, 'input');
                if (!from || !to) return null;
                const isSelected = edge.id === selectedEdgeId;
                const midX = (from.x + to.x) / 2;
                const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
                return (
                  <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                    <path d={path} fill="none" stroke={isSelected ? 'var(--color-primary-blue)' : 'var(--color-slate-gray)'} strokeWidth={isSelected ? 3 : 2} onClick={() => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} />
                    <path d={path} fill="none" stroke="transparent" strokeWidth={12} onClick={() => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} />
                  </g>
                );
              })}
              {drag?.type === 'edge' && drag.fromPort && (
                (() => {
                  const from = getPortPosition(drag.fromPort.nodeId, drag.fromPort.portId, 'output');
                  if (!from) return null;
                  const to = drag.currentPos;
                  const midX = (from.x + to.x) / 2;
                  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
                  return <path d={path} fill="none" stroke="var(--color-primary-blue)" strokeWidth={2} strokeDasharray="4 4" opacity={0.7} />;
                })()
              )}
            </svg>

            {nodes.map((node) => (
              <WorkflowNode
                key={node.id}
                node={node}
                nodeRegistry={nodeRegistry}
                isSelected={node.id === selectedNodeId}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onPortMouseDown={handlePortMouseDown}
              />
            ))}
          </div>
        </div>
      </div>

      <WorkflowInspector
        selectedNode={selectedNode}
        selectedNodeDef={selectedNodeDef}
        onConfigChange={handleConfigChange}
        onDeleteNode={handleDeleteNode}
      />

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Workflow Builder Help" size="md">
        <div style={{ lineHeight: 1.7, fontSize: 'var(--text-sm)' }}>
          <p><strong>Add nodes:</strong> Drag from the left palette onto the canvas.</p>
          <p><strong>Move nodes:</strong> Click and drag.</p>
          <p><strong>Connect nodes:</strong> Drag from an output port (right side) to an input port (left side).</p>
          <p><strong>Delete:</strong> Select a node or edge, then press <kbd>Delete</kbd>.</p>
          <p><strong>Pan canvas:</strong> Alt + drag, or middle-mouse drag.</p>
          <p><strong>Edit configuration:</strong> Click a node — the inspector appears on the right.</p>
          <p><strong>Publish:</strong> A workflow must have at least one trigger node and be published before it can run.</p>
        </div>
      </Modal>
    </div>
  );
}