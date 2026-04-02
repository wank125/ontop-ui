import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Select, Space, Button, Tag, Spin, Tooltip, Drawer, Descriptions } from 'antd';
import { ApartmentOutlined, ReloadOutlined, ZoomInOutlined, ZoomOutOutlined, InfoCircleOutlined } from '@ant-design/icons';
import cytoscape from 'cytoscape';
import { mappingsApi } from '../../api/client';

const OntologyVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [files, setFiles] = useState<{ path: string; filename: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    mappingsApi.list().then(({ data }) => {
      setFiles(data);
      if (data.length > 0) setSelectedFile(data[0].path);
    });
  }, []);

  const parseContent = useCallback((content: any) => {
    const nodes: cytoscape.ElementDefinition[] = [];
    const edges: cytoscape.ElementDefinition[] = [];
    const classSet = new Set<string>();

    for (const m of content.mappings) {
      const target: string = m.target;

      for (const cm of target.matchAll(/a\s+<([^>]+)>/g)) {
        classSet.add(cm[1].split('/').pop()!);
      }

      if (target.includes('#ref-')) {
        const subjectMatch = target.match(/<([^>]+)\/([^\/]+)\/[^=]+=/);
        const subjectClass = subjectMatch?.[2] || 'unknown';
        const objectMatch = [...target.matchAll(/<[^>]+#ref-[^>]+>\s+<([^>]+)\/([^\/]+)\/[^=]+=/g)];
        const objectClass = objectMatch.length > 0 ? objectMatch[0][2] : 'unknown';
        const propMatch = target.match(/#([^>]*ref-[^>]*)>/);
        const propName = propMatch?.[1] || 'ref';

        classSet.add(subjectClass);
        classSet.add(objectClass);

        edges.push({
          data: {
            id: `e-${subjectClass}-${propName}-${objectClass}`,
            source: subjectClass,
            target: objectClass,
            label: propName,
          },
        });
      } else {
        const classMatch = target.match(/a\s+<([^>]+)>/);
        const className = classMatch?.[1].split('/').pop() || 'unknown';
        classSet.add(className);

        const props: string[] = [];
        for (const pm of target.matchAll(/<[^>]+#([^>]+)>\s+\{/g)) {
          if (!pm[1].startsWith('ref-')) props.push(pm[1]);
        }

        const existing = nodes.find(n => n.data.id === className);
        if (existing) {
          existing.data.props = [...new Set([...(existing.data.props || []), ...props])];
        } else {
          nodes.push({ data: { id: className, label: className, props } });
        }
      }
    }

    for (const cls of classSet) {
      if (!nodes.find(n => n.data.id === cls)) {
        nodes.push({ data: { id: cls, label: cls, props: [] } });
      }
    }

    return { nodes, edges };
  }, []);

  const renderGraph = useCallback((content: any) => {
    const container = containerRef.current;
    if (!container) return;

    if (container.clientHeight === 0 || container.clientWidth === 0) {
      requestAnimationFrame(() => renderGraph(content));
      return;
    }

    cyRef.current?.destroy();
    cyRef.current = null;

    const { nodes, edges } = parseContent(content);
    setNodeCount(nodes.length);

    const styles: cytoscape.Stylesheet[] = [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'background-color': '#1677ff',
          color: '#fff',
          'font-size': 13,
          'font-weight': 'bold',
          'text-outline-width': 2,
          'text-outline-color': '#1677ff',
          width: 120,
          height: 56,
          shape: 'round-rectangle',
          'text-wrap': 'wrap',
          'text-max-width': 110,
          'transition-property': 'background-color, border-width, border-color',
          'transition-duration': '0.2s',
        },
      },
      {
        selector: 'node:hover',
        style: {
          'background-color': '#4096ff',
          'border-width': 3,
          'border-color': '#69b1ff',
          'cursor': 'pointer',
        },
      },
      {
        selector: 'node.selected',
        style: {
          'background-color': '#1677ff',
          'border-width': 3,
          'border-color': '#ffa940',
        },
      },
      {
        selector: 'node.dimmed',
        style: {
          'background-color': '#d9d9d9',
          color: '#bbb',
          'text-outline-color': '#d9d9d9',
          opacity: 0.4,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#bfbfbf',
          'target-arrow-color': '#bfbfbf',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: 'data(label)',
          'font-size': 11,
          'text-rotation': 'autorotate',
          'text-outline-width': 3,
          'text-outline-color': '#fff',
          color: '#666',
          'text-background-opacity': 1,
          'text-background-color': '#fff',
          'text-background-padding': '2px',
          'transition-property': 'line-color, target-arrow-color, width',
          'transition-duration': '0.2s',
        },
      },
      {
        selector: 'edge:hover',
        style: {
          width: 3,
          'line-color': '#1677ff',
          'target-arrow-color': '#1677ff',
          color: '#1677ff',
          'font-size': 12,
        },
      },
      {
        selector: 'edge.highlighted',
        style: {
          width: 3,
          'line-color': '#1677ff',
          'target-arrow-color': '#1677ff',
          color: '#1677ff',
        },
      },
      {
        selector: 'edge.dimmed',
        style: {
          'line-color': '#e8e8e8',
          'target-arrow-color': '#e8e8e8',
          opacity: 0.3,
          label: '',
        },
      },
    ];

    const cy = cytoscape({
      elements: [...nodes, ...edges],
      style: styles,
      headless: true,
    });

    cy.mount(container);
    requestAnimationFrame(() => {
      cy.resize();
      const n = nodes.length;
      let layoutOpts: any;
      if (n <= 6) {
        layoutOpts = {
          name: 'circle',
          padding: 60,
          spacingFactor: 1.2,
          animate: true,
          animationDuration: 500,
          fit: true,
        };
      } else if (n <= 15) {
        layoutOpts = {
          name: 'cose',
          padding: 60,
          nodeRepulsion: () => 8000,
          idealEdgeLength: () => 100,
          animate: true,
          animationDuration: 600,
          fit: true,
        };
      } else {
        layoutOpts = {
          name: 'cose',
          padding: 40,
          nodeRepulsion: () => 12000,
          idealEdgeLength: () => 80,
          animate: true,
          animationDuration: 800,
          fit: true,
        };
      }
      const layout = cy.layout(layoutOpts);
      layout.run();
    });

    // Click node: highlight neighborhood + show drawer
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const props: string[] = node.data('props') || [];

      // Reset all
      cy.elements().removeClass('selected highlighted dimmed');

      if (node.hasClass('selected')) {
        setNodeInfo(null);
        setDrawerOpen(false);
        return;
      }

      // Highlight selected + neighborhood
      node.addClass('selected');
      node.neighborhood().addClass('highlighted');
      cy.elements().not(node).not(node.neighborhood()).addClass('dimmed');

      const outgoing = node.outgoers('edge').map(e => ({
        label: e.data('label'),
        target: e.target().id(),
      }));
      const incoming = node.incomers('edge').map(e => ({
        label: e.data('label'),
        source: e.source().id(),
      }));

      setNodeInfo({
        id: node.id(),
        props,
        outgoing,
        incoming,
      });
      setDrawerOpen(true);
    });

    // Click background: reset highlight
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('selected highlighted dimmed');
        setNodeInfo(null);
        setDrawerOpen(false);
      }
    });

    cyRef.current = cy;
    setLoading(false);
  }, [parseContent]);

  useEffect(() => {
    if (!selectedFile) return;
    setLoading(true);
    mappingsApi.content(selectedFile).then(({ data }) => {
      renderGraph(data);
    }).catch(() => setLoading(false));
  }, [selectedFile, renderGraph]);

  const handleZoomIn = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const handleZoomOut = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const handleFit = () => cyRef.current?.fit(undefined, 60);

  const canvasHeight = Math.max(400, Math.min(700, nodeCount * 60 + 200));

  return (
    <div>
      <Card
        title={<span><ApartmentOutlined /> 本体可视化</span>}
        extra={
          <Space>
            <Select
              style={{ width: 300 }}
              placeholder="选择映射文件"
              value={selectedFile || undefined}
              onChange={setSelectedFile}
              options={files.map(f => ({ value: f.path, label: f.filename }))}
            />
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>放大</Button>
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>缩小</Button>
            <Button icon={<ReloadOutlined />} onClick={handleFit}>适应</Button>
          </Space>
        }
      >
        <div style={{ position: 'relative', width: '100%', height: canvasHeight, border: '1px solid #f0f0f0', borderRadius: 8, textAlign: 'left' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 8, zIndex: 10 }}>
              <Spin size="large" />
            </div>
          )}
          {/* Inline legend */}
          <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 8, zIndex: 5 }}>
            <Tag color="blue" style={{ margin: 0 }}>类（Entity Type）</Tag>
            <Tag style={{ margin: 0 }}>箭头 = 对象属性（关系）</Tag>
            <Tag color="green" style={{ margin: 0 }}>点击节点查看详情</Tag>
          </div>
        </div>
      </Card>

      {/* Node detail drawer */}
      <Drawer
        title={<span><InfoCircleOutlined /> 节点详情</span>}
        placement="right"
        width={360}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          cyRef.current?.elements().removeClass('selected highlighted dimmed');
        }}
      >
        {nodeInfo && (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="类名">{nodeInfo.id}</Descriptions.Item>
              <Descriptions.Item label="数据属性">
                {nodeInfo.props.length > 0
                  ? nodeInfo.props.map((p: string) => <Tag key={p} style={{ marginBottom: 2 }}>{p}</Tag>)
                  : <span style={{ color: '#999' }}>无</span>
                }
              </Descriptions.Item>
            </Descriptions>

            {nodeInfo.outgoing.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>出边关系</div>
                {nodeInfo.outgoing.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                    <Tag color="blue">{e.label}</Tag> → <Tag>{e.target}</Tag>
                  </div>
                ))}
              </div>
            )}

            {nodeInfo.incoming.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>入边关系</div>
                {nodeInfo.incoming.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                    <Tag>{e.source}</Tag> → <Tag color="blue">{e.label}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default OntologyVisualizer;
