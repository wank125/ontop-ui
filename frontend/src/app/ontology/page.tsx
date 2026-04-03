'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import {
  GitGraph,
  ZoomIn,
  ZoomOut,
  Maximize,
  RefreshCw,
  Info,
  Loader2,
} from 'lucide-react';
import { mappings, type MappingFile } from '@/lib/api';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'class' | 'resource';
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

function parseMappingToGraph(mappingTargets: Array<{ target: string }>): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeInfo: Record<string, { fields: string[] }>;
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeInfo: Record<string, { fields: string[] }> = {};
  const classSet = new Set<string>();

  for (const m of mappingTargets) {
    const target = m.target;

    // Extract class names from "a <...>" patterns
    for (const cm of target.matchAll(/a\s+<([^>]+)>/g)) {
      const cls = cm[1].split('/').pop()!;
      classSet.add(cls);
    }

    if (target.includes('#ref-')) {
      // Object property → edge
      const subjectMatch = target.match(/<([^>]+)\/([^\/]+)\/[^=]+=/);
      const subjectClass = subjectMatch?.[2] || 'unknown';
      const objectMatch = [...target.matchAll(/<[^>]+#ref-[^>]+>\s+<([^>]+)\/([^\/]+)\/[^=]+=/g)];
      const objectClass = objectMatch.length > 0 ? objectMatch[0][2] : 'unknown';
      const propMatch = target.match(/#([^>]*ref-[^>]*)>/);
      const propName = propMatch?.[1] || 'ref';

      classSet.add(subjectClass);
      classSet.add(objectClass);

      edges.push({
        id: `e-${subjectClass}-${propName}-${objectClass}`,
        source: subjectClass,
        target: objectClass,
        label: propName,
      });
    } else {
      // Data property → node fields
      const classMatch = target.match(/a\s+<([^>]+)>/);
      const className = classMatch?.[1].split('/').pop() || 'unknown';
      classSet.add(className);

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

  // Create nodes with positioned layout
  const classArray = Array.from(classSet);
  const centerX = 400;
  const centerY = 300;
  const radius = Math.max(150, classArray.length * 40);

  classArray.forEach((cls, i) => {
    const angle = (2 * Math.PI * i) / classArray.length - Math.PI / 2;
    if (!nodeInfo[cls]) nodeInfo[cls] = { fields: [] };
    nodes.push({
      id: cls,
      label: cls,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      type: 'class',
    });
  });

  return { nodes, edges, nodeInfo };
}

export default function OntologyPage() {
  const [files, setFiles] = useState<MappingFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [nodeInfo, setNodeInfo] = useState<Record<string, { fields: string[] }>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    mappings.listFiles().then((list) => {
      setFiles(list);
      if (list.length > 0) setSelectedPath(list[0].path);
    });
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    mappings.getContent(selectedPath)
      .then((content) => {
        const graph = parseMappingToGraph(content.mappings);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setNodeInfo(graph.nodeInfo);
      })
      .catch(() => {
        setNodes([]);
        setEdges([]);
        setNodeInfo({});
      })
      .finally(() => setLoading(false));
  }, [selectedPath]);

  // 绘制图谱
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 绘制边
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;
      ctx.quadraticCurveTo(midX, midY, targetNode.x, targetNode.y);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 箭头
      const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
      const arrowLength = 10;
      const arrowX = targetNode.x - Math.cos(angle) * 40;
      const arrowY = targetNode.y - Math.sin(angle) * 40;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - arrowLength * Math.cos(angle - Math.PI / 6), arrowY - arrowLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(arrowX - arrowLength * Math.cos(angle + Math.PI / 6), arrowY - arrowLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = '#6b7280';
      ctx.fill();

      // 标签
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, midX, midY - 10);
    });

    // 绘制节点
    nodes.forEach((node) => {
      const isSelected = node.id === selectedNode;
      const width = 140;
      const height = 40;
      ctx.beginPath();
      ctx.roundRect(node.x - width / 2, node.y - height / 2, width, height, 8);
      ctx.fillStyle = isSelected ? '#1e1b4b' : '#1f2937';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#8b5cf6' : '#6366f1';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });

    ctx.restore();
  }, [nodes, edges, scale, offset, selectedNode]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    const clickedNode = nodes.find((node) => {
      return x >= node.x - 70 && x <= node.x + 70 && y >= node.y - 20 && y <= node.y + 20;
    });
    if (clickedNode) {
      setSelectedNode(clickedNode.id);
      setDraggingNode(clickedNode.id);
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingNode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    setNodes((prev) => prev.map((node) => (node.id === draggingNode ? { ...node, x, y } : node)));
  };

  const handleMouseUp = () => setDraggingNode(null);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));
  const handleFit = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* 页面头部 */}
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
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFit}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 画布区域 */}
        <div className="relative flex-1 bg-muted/20">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <GitGraph className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>选择映射文件查看本体图谱</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={1200}
              height={800}
              className="h-full w-full cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          )}

          {/* 图例 */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-xs font-medium">图例</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-8 rounded border border-primary bg-muted" />
                  <span>类 (Entity Type)</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-8" viewBox="0 0 32 16">
                    <line x1="4" y1="8" x2="28" y2="8" stroke="#6b7280" strokeWidth="1.5" />
                    <polygon points="28,8 22,5 22,11" fill="#6b7280" />
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

        {/* 右侧详情面板 */}
        <div className="w-72 border-l border-border p-4">
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

                {/* 关联关系 */}
                {edges.some((e) => e.source === selectedNode || e.target === selectedNode) && (
                  <>
                    <h4 className="mb-2 mt-4 text-xs font-medium text-muted-foreground">关系</h4>
                    <div className="space-y-1">
                      {edges
                        .filter((e) => e.source === selectedNode)
                        .map((e) => (
                          <div key={e.id} className="rounded bg-muted/50 px-2 py-1 text-xs">
                            <span className="text-primary">{e.label}</span> → {e.target}
                          </div>
                        ))}
                      {edges
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

          {/* 统计信息 */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">图谱统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">实体类</span>
                <span>{nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">关系</span>
                <span>{edges.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
