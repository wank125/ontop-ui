'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitGraph, Info, Loader2 } from 'lucide-react';
import { mappings, type MappingFile } from '@/lib/api';

// ── Data types (preserved from original) ────────────────

interface ParsedGraph {
  classes: string[];
  edges: Array<{ id: string; source: string; target: string; label: string }>;
  nodeInfo: Record<string, { fields: string[] }>;
}

function parseMappingToGraph(mappingTargets: Array<{ target: string }>): ParsedGraph {
  const classSet = new Set<string>();
  const edges: ParsedGraph['edges'] = [];
  const nodeInfo: ParsedGraph['nodeInfo'] = {};

  // Helper: extract class name from a URI like http://example.com/retail/dim_employee
  const classFromUri = (uri: string): string => uri.split('/').pop()!;

  // First pass: identify all classes from "a <...>" patterns only
  for (const m of mappingTargets) {
    for (const cm of m.target.matchAll(/a\s+<([^>]+)>/g)) {
      classSet.add(classFromUri(cm[1]));
    }
  }

  // Second pass: parse edges and fields
  for (const m of mappingTargets) {
    const target = m.target;

    if (target.includes('#ref-')) {
      // Object property (relationship) — extract classes from URI segments
      // Subject: first URI, e.g. <http://example.com/retail/dim_employee/emp_id={...}>
      //   → split path: [..., "retail", "dim_employee", "emp_id={...}"] → class = "dim_employee"
      const subjectUri = target.match(/^<([^>]+)>/)?.[1] || '';
      const subjectSegments = subjectUri.split('/').filter(Boolean);
      const subjectClass = subjectSegments.length >= 2 ? subjectSegments[subjectSegments.length - 2] : 'unknown';
      // Object: URI after the ref- property, e.g. <http://example.com/retail/dim_store/store_id={...}>
      const objectUri = [...target.matchAll(/<[^>]+#ref-[^>]+>\s+<([^>]+)>/g)];
      const objectSegments = objectUri.length > 0 ? objectUri[0][1].split('/').filter(Boolean) : [];
      const objectClass = objectSegments.length >= 2 ? objectSegments[objectSegments.length - 2] : 'unknown';
      // Property name from ref-
      const propMatch = target.match(/#([^>]*ref-[^>]*)>/);
      const propName = propMatch?.[1] || 'ref';

      // Only add edge if both classes are known real classes
      if (classSet.has(subjectClass) && classSet.has(objectClass)) {
        edges.push({
          id: `e-${subjectClass}-${propName}-${objectClass}`,
          source: subjectClass,
          target: objectClass,
          label: propName,
        });
      }
    } else {
      // Data property — extract fields for the class
      const classMatch = target.match(/a\s+<([^>]+)>/);
      if (!classMatch) continue;
      const className = classFromUri(classMatch[1]);

      const props: string[] = [];
      for (const pm of target.matchAll(/<[^>]+#([^>]+)>\s+\{/g)) {
        if (!pm[1].startsWith('ref-')) props.push(pm[1]);
      }

      if (nodeInfo[className]) {
        nodeInfo[className].fields = [...new Set([...nodeInfo[className].fields, ...props])];
      } else {
        nodeInfo[className] = { fields: props };
      }
    }
  }

  return { classes: Array.from(classSet), edges, nodeInfo };
}

// ── Dagre layout ────────────────────────────────────────

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

function getLayoutedElements(
  classes: string[],
  edges: ParsedGraph['edges'],
  nodeInfo: Record<string, { fields: string[] }>,
): { nodes: Node[]; edges: Edge[] } {
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  const nodeHeight = (cls: string) => {
    const fields = nodeInfo[cls]?.fields ?? [];
    return fields.length > 0 ? 56 + fields.length * 20 : 56;
  };

  const nodes: Node[] = classes.map((cls) => ({
    id: cls,
    type: 'classNode',
    data: { label: cls, fields: nodeInfo[cls]?.fields ?? [] },
    position: { x: 0, y: 0 },
  }));

  nodes.forEach((node) =>
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node.id) }),
  );

  const rfEdges: Edge[] = edges.map((e) => {
    // Clean label: remove "ref-" prefix for display
    const displayLabel = e.label.replace(/^ref-/, '');
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      label: displayLabel,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'oklch(0.55 0.12 200)' },
      style: { stroke: 'oklch(0.50 0.08 270)', strokeWidth: 1.5 },
      labelStyle: { fill: 'oklch(0.65 0.08 200)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 },
      labelBgStyle: { fill: 'oklch(0.14 0.01 270)', fillOpacity: 0.95, stroke: 'oklch(0.28 0.02 270)', strokeWidth: 0.5 },
      labelBgPadding: [4, 8] as [number, number],
      labelBgBorderRadius: 6,
    };
  });

  rfEdges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id);
    node.position = { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
  });

  return { nodes, edges: rfEdges };
}

// ── Custom ClassNode ────────────────────────────────────

interface ClassNodeData extends Record<string, unknown> {
  label: string;
  fields: string[];
}

function ClassNode({ data, selected }: NodeProps) {
  const d = data as unknown as ClassNodeData;
  return (
    <div
      className={`
        min-w-[180px] rounded-xl border backdrop-blur-sm transition-all duration-200
        ${selected
          ? 'border-primary shadow-[0_0_24px_oklch(0.70_0.15_280_/_0.35)] scale-[1.03]'
          : 'border-border/60 bg-card/90 hover:border-primary/40 hover:shadow-[0_0_16px_oklch(0.70_0.15_280_/_0.15)]'
        }
        bg-card/90
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !border-0 !top-[-4px]" />
      <div className="flex items-center gap-2.5 rounded-t-xl bg-gradient-to-r from-primary/25 via-primary/10 to-accent/10 px-3.5 py-2 border-b border-border/50">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 border border-primary/30">
          <GitGraph className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-wide">{d.label}</span>
      </div>
      {d.fields && d.fields.length > 0 && (
        <div className="px-3.5 py-2 space-y-0.5">
          {d.fields.map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-1 w-1 rounded-full bg-primary/50" />
              <span className="font-mono">{f}</span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !border-0 !bottom-[-4px]" />
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

// ── MiniMap node color ──────────────────────────────────

const miniMapNodeColor = () => 'oklch(0.70 0.15 280)';

// ── Page Component ──────────────────────────────────────

export default function OntologyPage() {
  const [files, setFiles] = useState<MappingFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedGraph | null>(null);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    mappings.listFiles().then((list) => {
      setFiles(list);
      if (list.length > 0) setSelectedPath(list[0].path);
    });
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    mappings
      .getContent(selectedPath)
      .then((content) => {
        const graph = parseMappingToGraph(content.mappings);
        setParsedData(graph);
        const { nodes, edges } = getLayoutedElements(graph.classes, graph.edges, graph.nodeInfo);
        setRfNodes(nodes);
        setRfEdges(edges);
      })
      .catch(() => {
        setParsedData(null);
        setRfNodes([]);
        setRfEdges([]);
      })
      .finally(() => setLoading(false));
  }, [selectedPath, setRfNodes, setRfEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const nodeInfo = parsedData?.nodeInfo ?? {};
  const graphEdges = parsedData?.edges ?? [];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* Header */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
              <GitGraph className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">本体可视化</h1>
              <p className="text-sm text-muted-foreground">可视化数据模型结构</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPath} onValueChange={setSelectedPath}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择映射文件" />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file.path} value={file.path}>
                    {file.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* React Flow Canvas */}
        <div className="relative flex-1 bg-muted/20">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rfNodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <GitGraph className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>选择映射文件查看本体图谱</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
            >
              <Controls
                className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
              />
              <MiniMap
                nodeColor={miniMapNodeColor}
                maskColor="oklch(0.12 0.01 270 / 80%)"
                className="!bg-card !border-border"
              />
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="oklch(0.35 0.02 270)" />
            </ReactFlow>
          )}

          {/* Legend */}
          {rfNodes.length > 0 && (
            <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-xs font-medium">图例</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-8 rounded border border-primary bg-primary/20" />
                  <span>类 (Entity Type)</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-8" viewBox="0 0 32 16">
                    <line x1="4" y1="8" x2="28" y2="8" stroke="oklch(0.55 0.10 270)" strokeWidth="1.5" />
                    <polygon points="28,8 22,5 22,11" fill="oklch(0.55 0.10 270)" />
                  </svg>
                  <span>对象属性 (关系)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  <span>点击节点查看详情</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-72 border-l border-border p-4 overflow-y-auto">
          {selectedNode && nodeInfo[selectedNode] ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedNode}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">字段</h4>
                <div className="space-y-1">
                  {nodeInfo[selectedNode].fields.length > 0 ? (
                    nodeInfo[selectedNode].fields.map((field) => (
                      <div key={field} className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">
                        {field}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">无数据属性</p>
                  )}
                </div>

                {graphEdges.some((e) => e.source === selectedNode || e.target === selectedNode) && (
                  <>
                    <h4 className="mb-2 mt-4 text-xs font-medium text-muted-foreground">关系</h4>
                    <div className="space-y-1">
                      {graphEdges
                        .filter((e) => e.source === selectedNode)
                        .map((e) => (
                          <div key={e.id} className="rounded bg-muted/50 px-2 py-1 text-xs">
                            <span className="text-primary">{e.label}</span> → {e.target}
                          </div>
                        ))}
                      {graphEdges
                        .filter((e) => e.target === selectedNode)
                        .map((e) => (
                          <div key={e.id} className="rounded bg-muted/50 px-2 py-1 text-xs">
                            {e.source} → <span className="text-primary">{e.label}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <GitGraph className="mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">点击节点查看详细信息</p>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">图谱统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">实体类</span>
                <Badge variant="secondary">{rfNodes.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">关系</span>
                <Badge variant="secondary">{rfEdges.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
