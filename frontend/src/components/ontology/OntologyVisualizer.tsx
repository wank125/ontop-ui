import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Space, Button, Tag, Spin } from 'antd';
import { ApartmentOutlined, ReloadOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import cytoscape from 'cytoscape';
import { mappingsApi } from '../../api/client';
import type { MappingContent } from '../../types';

const OntologyVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [files, setFiles] = useState<{ path: string; filename: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    mappingsApi.list().then(({ data }) => {
      setFiles(data);
      if (data.length > 0) setSelectedFile(data[0].path);
    });
  }, []);

  const buildGraph = async (filePath: string) => {
    if (!filePath) return;
    setLoading(true);
    try {
      const { data } = await mappingsApi.content(filePath);
      const content = data as MappingContent;
      renderGraph(content);
    } catch (e) {
      console.error('Failed to load mapping', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedFile) buildGraph(selectedFile);
  }, [selectedFile]);

  const renderGraph = (content: MappingContent) => {
    if (!containerRef.current) return;

    // Destroy previous instance
    cyRef.current?.destroy();

    const nodes: cytoscape.ElementDefinition[] = [];
    const edges: cytoscape.ElementDefinition[] = [];
    const classSet = new Set<string>();
    const propMap = new Map<string, { label: string; type: 'data' | 'object'; from: string; to: string }>();

    // Parse mappings to extract classes, properties, relationships
    for (const m of content.mappings) {
      const target = m.target;

      // Extract classes from "a <class_uri>"
      const classMatches = target.matchAll(/a\s+<([^>]+)>/g);
      for (const cm of classMatches) {
        const cls = cm[1].split('/').pop() || cm[1];
        classSet.add(cls);
      }

      // Check if this is a relationship mapping (contains ref-)
      const isRelation = target.includes('#ref-');

      if (isRelation) {
        // Extract subject class
        const subjectMatch = target.match(/<([^>]+)\/([^\/]+)\/[^=]+=/);
        const subjectClass = subjectMatch ? subjectMatch[2] : 'unknown';

        // Extract object class
        const objectMatch = target.match(/<[^>]+#ref-[^>]+>\s+<([^>]+)\/([^\/]+)\/[^=]+=/);
        const objectClass = objectMatch ? objectMatch[2] : 'unknown';

        // Extract property name
        const propMatch = target.match(/#([^>]+ref-[^>]+)>/);
        const propName = propMatch ? propMatch[1] : 'ref';

        classSet.add(subjectClass);
        classSet.add(objectClass);

        edges.push({
          data: {
            id: `e-${subjectClass}-${propName}-${objectClass}`,
            source: subjectClass,
            target: objectClass,
            label: propName,
            type: 'object',
          },
        });
      } else {
        // Class mapping - extract data properties
        const classMatch = target.match(/a\s+<([^>]+)>/);
        const className = classMatch ? (classMatch[1].split('/').pop() || 'unknown') : 'unknown';
        classSet.add(className);

        // Extract data properties
        const propMatches = target.matchAll(/<[^>]+#([^>]+)>\s+\{/g);
        const props: string[] = [];
        for (const pm of propMatches) {
          const pName = pm[1];
          if (!pName.startsWith('ref-')) {
            props.push(pName);
          }
        }

        // Store props as node metadata
        const existingNode = nodes.find(n => n.data.id === className);
        if (existingNode) {
          existingNode.data.props = [...new Set([...(existingNode.data.props || []), ...props])];
        } else {
          nodes.push({
            data: { id: className, label: className, props },
          });
        }
      }
    }

    // Ensure all classes have nodes
    for (const cls of classSet) {
      if (!nodes.find(n => n.data.id === cls)) {
        nodes.push({ data: { id: cls, label: cls, props: [] } });
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#1677ff',
            'color': '#fff',
            'font-size': 14,
            'font-weight': 'bold',
            'text-outline-width': 2,
            'text-outline-color': '#1677ff',
            'width': 120,
            'height': 60,
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': 110,
          } as cytoscape.Stylesheet,
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#999',
            'target-arrow-color': '#999',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': 11,
            'text-rotation': 'autorotate',
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            'color': '#666',
          } as cytoscape.Stylesheet,
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0.1,
          } as cytoscape.Stylesheet,
        },
      ],
      layout: {
        name: 'cose',
        padding: 50,
        nodeRepulsion: 8000,
        idealEdgeLength: 150,
        animate: true,
        animationDuration: 500,
      },
    });

    cyRef.current = cy;
  };

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
  const handleFit = () => cyRef.current?.fit(undefined, 50);

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
        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" tip="加载中..." /></div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: 500, border: '1px solid #f0f0f0', borderRadius: 8 }} />
        )}
      </Card>

      <Card title="图例" style={{ marginTop: 12 }} size="small">
        <Space>
          <Tag color="blue">蓝色方块 = 类（Entity Type）</Tag>
          <Tag color="default">箭头连线 = 对象属性（关系）</Tag>
          <Tag color="green">节点属性 = 数据属性（字段）</Tag>
        </Space>
      </Card>
    </div>
  );
};

export default OntologyVisualizer;
