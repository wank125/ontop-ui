import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Select, Space, Button, Tag, Spin } from 'antd';
import { ApartmentOutlined, ReloadOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import cytoscape from 'cytoscape';
import { mappingsApi } from '../../api/client';

const OntologyVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [files, setFiles] = useState<{ path: string; filename: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<string>('');

  useEffect(() => {
    mappingsApi.list().then(({ data }) => {
      setFiles(data);
      if (data.length > 0) setSelectedFile(data[0].path);
    });
  }, []);

  const renderGraph = useCallback((content: any) => {
    const container = containerRef.current;
    if (!container) return;

    // Wait for container to be visible
    if (container.clientHeight === 0) {
      setTimeout(() => renderGraph(content), 100);
      return;
    }

    // Destroy previous
    cyRef.current?.destroy();
    cyRef.current = null;

    const nodes: cytoscape.ElementDefinition[] = [];
    const edges: cytoscape.ElementDefinition[] = [];
    const classSet = new Set<string>();

    for (const m of content.mappings) {
      const target: string = m.target;

      // Extract classes
      for (const cm of target.matchAll(/a\s+<([^>]+)>/g)) {
        classSet.add(cm[1].split('/').pop()!);
      }

      if (target.includes('#ref-')) {
        // Relationship mapping
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
        // Class mapping
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

    const cy = cytoscape({
      container,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#1677ff',
            color: '#fff',
            'font-size': 14,
            'font-weight': 'bold',
            'text-outline-width': 2,
            'text-outline-color': '#1677ff',
            width: 140,
            height: 70,
            shape: 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': 130,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#999',
            'target-arrow-color': '#999',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 11,
            'text-rotation': 'autorotate',
            'text-outline-width': 3,
            'text-outline-color': '#fff',
            color: '#555',
          },
        },
      ] as cytoscape.Stylesheet[],
      layout: {
        name: 'cose',
        padding: 60,
        nodeRepulsion: () => 10000,
        idealEdgeLength: () => 180,
        animate: true,
        animationDuration: 800,
        randomize: true,
      },
    });

    // Click node to show properties
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const props: string[] = node.data('props') || [];
      setNodeInfo(
        `类: ${node.id()}\n数据属性: ${props.length > 0 ? props.join(', ') : '无'}\n` +
        `出边: ${node.outgoers('edge').size} 条 | 入边: ${node.incomers('edge').size} 条`
      );
    });

    cyRef.current = cy;
    setLoading(false);
  }, []);

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
        <div style={{ position: 'relative', width: '100%', height: 500, border: '1px solid #f0f0f0', borderRadius: 8 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
              <Spin size="large" />
            </div>
          )}
        </div>
      </Card>

      {nodeInfo && (
        <Card title="节点详情" style={{ marginTop: 12 }} size="small">
          <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{nodeInfo}</pre>
        </Card>
      )}

      <Card title="图例" style={{ marginTop: 12 }} size="small">
        <Space wrap>
          <Tag color="blue">蓝色方块 = 类（Entity Type）</Tag>
          <Tag>箭头连线 = 对象属性（关系）</Tag>
          <Tag color="green">点击节点查看数据属性</Tag>
        </Space>
      </Card>
    </div>
  );
};

export default OntologyVisualizer;
