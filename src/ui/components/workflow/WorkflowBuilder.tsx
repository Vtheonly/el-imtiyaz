/**
 * WorkflowBuilder — drag-and-drop node graph editor.
 *
 * Features:
 *   - Drag nodes from the palette onto the canvas
 *   - Click a node to select; drag to move
 *   - Drag from an output port to an input port to create edges
 *   - Click an edge to select; Delete key removes selected
 *   - Right-click a node to delete or duplicate
 *   - Inspector panel on the right shows the selected node's config form
 *   - Save / Publish / Run buttons in the toolbar
 *
 * Implementation notes:
 *   - The canvas is an absolutely-positioned div with SVG underneath for edges
 *   - Nodes are absolutely positioned divs at (x, y) in canvas coordinates
 *   - Panning: hold Space + drag, or middle-mouse drag
 *   - Zoom: ctrl + scroll (visual only — coords stay in canvas space)
 *
 * The component is fully controlled: parent owns the nodes/edges state.
 */

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import * as Lucide from 'lucide-react';
import { Button, Badge, Modal } from '../common';
import { SmartForm } from '../forms/SmartForm';
import type {
  Workflow, WorkflowNode, WorkflowEdge, NodeType
} from '@core/entities/workflow.entity';
import type { NodeDefinition, NodeConfigField } from '../../../services/workflow/node-registry';

interface WorkflowBuilderProps {
  workflow: Workflow;
  nodeRegistry: NodeDefinition[];
  onChange: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  onSave: () => void;
  onPublish: () => void;
  onRun: () => void;
  saving?: boolean;
  publishing?: boolean;
  running?: boolean;
}

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
const NODE_HEIGHT = 80;
const PORT_RADIUS = 8;

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  trigger: '#3fa66e',
  condition: '#c8a98c',
  action: '#349bd4',
  delay: '#836c68',
  transform: '#9b6ec1'
};

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
  const selectedNodeDef = selectedNode
    ? nodeRegistry.find((n) => n.id === selectedNode.subtype)
    : null;

  // ── Helpers ────────────────────────────────────────────────────────────
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

  // ── Drag handlers ──────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan
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

  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
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

  const handlePortMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    portId: string,
    portType: 'input' | 'output'
  ) => {
    e.stopPropagation();
    if (portType !== 'output') return; // only drag from outputs
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
    } else {
      setDrag({ ...drag, currentPos: screenToCanvas(e.clientX, e.clientY) });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drag) return;

    if (drag.type === 'node' && drag.nodeId && drag.offset) {
      const newPos = screenToCanvas(e.clientX, e.clientY);
      const updatedNodes = nodes.map((n) =>
        n.id === drag.nodeId
          ? { ...n, position: { x: newPos.x - drag.offset!.x, y: newPos.y - drag.offset!.y } }
          : n
      );
      onChange(updatedNodes, edges);
    } else if (drag.type === 'edge' && drag.fromPort) {
      // Find the port under the cursor
      const target = (e.target as HTMLElement).dataset.port;
      const targetNode = (e.target as HTMLElement).dataset.nodeId;
      if (target && targetNode) {
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: drag.fromPort.nodeId,
          sourcePort: drag.fromPort.portId,
          target: targetNode,
          targetPort: target
        };
        // Prevent duplicate edges
        const exists = edges.some(
          (e) => e.source === newEdge.source && e.sourcePort === newEdge.sourcePort
            && e.target === newEdge.target && e.targetPort === newEdge.targetPort
        );
        if (!exists) {
          onChange(nodes, [...edges, newEdge]);
        }
      }
    }

    setDrag(null);
  };

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (selectedNodeId) {
          onChange(
            nodes.filter((n) => n.id !== selectedNodeId),
            edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
          );
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          onChange(nodes, edges.filter((e) => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, onChange]);

  // ── Palette drag-start ─────────────────────────────────────────────────
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
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      subtype: def.id,
      label: def.label,
      config: def.configSchema.reduce((acc, f) => {
        if (f.default !== undefined) acc[f.key] = f.default;
        return acc;
      }, {} as Record<string, unknown>),
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      inputs: def.inputs.map((p) => ({ ...p })),
      outputs: def.outputs.map((p) => ({ ...p }))
    };
    onChange([...nodes, newNode], edges);
  };

  // ── Inspector ──────────────────────────────────────────────────────────
  const handleConfigChange = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    const updatedNodes = nodes.map((n) =>
      n.id === selectedNodeId
        ? { ...n, config: { ...n.config, [key]: value } }
        : n
    );
    onChange(updatedNodes, edges);
  };

  // ── Render ─────────────────────────────────────────────────────────────
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
    <div className="flex h-full" style={{ overflow: 'hidden' }}>
      {/* ── Palette (left) ──────────────────────────────────────────── */}
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
            onChange={(e) => setPaletteSearch(e.target.value)}
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
                    onDragStart={(e) => handlePaletteDragStart(e, def)}
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

      {/* ── Canvas (center) ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-panel)'
          }}
        >
          <div className="flex items-center gap-3">
            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>
              {workflow.name}
            </div>
            <Badge tone={workflow.status === 'published' ? 'success' : 'neutral'}>
              {workflow.status} • v{workflow.version}
            </Badge>
            {workflow.enabled && <Badge tone="success" dot>Enabled</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowHelp(true)}>Help</Button>
            <Button size="sm" variant="ghost" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onPublish} disabled={publishing || workflow.status === 'published'}>
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
            <Button size="sm" variant="primary" onClick={onRun} disabled={running || workflow.status !== 'published'}>
              {running ? 'Running…' : 'Run Now'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
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
            background: `
              radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px),
              radial-gradient(circle at center, #2a2b2d 0%, var(--color-dark-bg) 70%)
            `,
            backgroundSize: '24px 24px, 100% 100%',
            cursor: drag?.type === 'pan' ? 'grabbing' : 'default'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%'
            }}
          >
            {/* Edges (SVG layer) */}
            <svg
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
              width="100%"
              height="100%"
            >
              {edges.map((edge) => {
                const from = getPortPosition(edge.source, edge.sourcePort, 'output');
                const to = getPortPosition(edge.target, edge.targetPort, 'input');
                if (!from || !to) return null;
                const isSelected = edge.id === selectedEdgeId;
                const midX = (from.x + to.x) / 2;
                const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
                return (
                  <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                    <path
                      d={path}
                      fill="none"
                      stroke={isSelected ? 'var(--color-primary-blue)' : 'var(--color-slate-gray)'}
                      strokeWidth={isSelected ? 3 : 2}
                      onClick={() => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      onClick={() => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                    />
                  </g>
                );
              })}
              {/* Active drag edge */}
              {drag?.type === 'edge' && drag.fromPort && (
                (() => {
                  const from = getPortPosition(drag.fromPort.nodeId, drag.fromPort.portId, 'output');
                  if (!from) return null;
                  const to = drag.currentPos;
                  const midX = (from.x + to.x) / 2;
                  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
                  return (
                    <path
                      d={path}
                      fill="none"
                      stroke="var(--color-primary-blue)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      opacity={0.7}
                    />
                  );
                })()
              )}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const def = nodeRegistry.find((n) => n.id === node.subtype);
              const Icon = def ? ((Lucide as any)[def.icon] ?? Lucide.Square) : Lucide.Square;
              const isSelected = node.id === selectedNodeId;
              const color = NODE_TYPE_COLORS[node.type];
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
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
                    cursor: drag?.type === 'node' && drag.nodeId === node.id ? 'grabbing' : 'grab',
                    transition: 'box-shadow var(--duration-fast) var(--ease-out)',
                    zIndex: isSelected ? 10 : 1
                  }}
                >
                  {/* Header */}
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
                  {/* Ports */}
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
                              <Port
                                label={input.label}
                                portId={input.id}
                                nodeId={node.id}
                                side="left"
                                color={color}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, input.id, 'input')}
                              />
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {output && (
                              <Port
                                label={output.label}
                                portId={output.id}
                                nodeId={node.id}
                                side="right"
                                color={color}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, output.id, 'output')}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {node.inputs.length === 0 && node.outputs.length === 0 && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: '4px 0' }}>
                        No ports
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Inspector (right) ───────────────────────────────────────── */}
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
              onChange={handleConfigChange}
            />
            <div className="el-divider" />
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onChange(
                  nodes.filter((n) => n.id !== selectedNode.id),
                  edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
                );
                setSelectedNodeId(null);
              }}
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

      {/* ── Help Modal ─────────────────────────────────────────────── */}
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

// ── Port component ─────────────────────────────────────────────────────
function Port({
  label,
  portId,
  nodeId,
  side,
  color,
  onMouseDown
}: {
  label: string;
  portId: string;
  nodeId: string;
  side: 'left' | 'right';
  color: string;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
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
              left: -PORT_RADIUS - 2,
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
          <span style={{ paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
        </>
      )}
      {side === 'right' && (
        <>
          <span style={{ paddingRight: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          <div
            data-port={portId}
            data-node-id={nodeId}
            onMouseDown={onMouseDown}
            style={{
              position: 'absolute',
              right: -PORT_RADIUS - 2,
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
