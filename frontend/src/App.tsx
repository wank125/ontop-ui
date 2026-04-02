import React, { useState, useEffect } from 'react';
import { ConfigProvider, Tabs, Layout, Typography, Badge, Space, theme } from 'antd';
import {
  DatabaseOutlined,
  ApartmentOutlined,
  SearchOutlined,
  RobotOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import DataSourceModule from './components/datasource/DataSourceModule';
import MappingModule from './components/mapping/MappingModule';
import SparqlModule from './components/sparql/SparqlModule';
import AIModule from './components/ai/AIModule';
import OntologyVisualizer from './components/ontology/OntologyVisualizer';
import { sparqlApi } from './api/client';
import type { EndpointStatus } from './types';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('datasources');
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>({ running: false, port: 8080 });

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await sparqlApi.endpointStatus();
        setEndpointStatus(data);
      } catch {
        setEndpointStatus({ running: false, port: 8080 });
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const tabItems = [
    {
      key: 'datasources',
      label: <span><DatabaseOutlined /> 数据源管理</span>,
      children: <DataSourceModule />,
    },
    {
      key: 'sparql',
      label: <span><SearchOutlined /> SPARQL 查询</span>,
      children: <SparqlModule />,
    },
    {
      key: 'mapping',
      label: <span><ApartmentOutlined /> 映射编辑</span>,
      children: <MappingModule />,
    },
    {
      key: 'ai',
      label: <span><RobotOutlined /> AI 助手</span>,
      children: <AIModule />,
    },
    {
      key: 'ontology',
      label: <span><ApartmentOutlined /> 本体可视化</span>,
      children: <OntologyVisualizer />,
    },
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <Title level={4} style={{ margin: 0, color: '#fff' }}>
            <ApiOutlined /> Ontop 管理平台
          </Title>
          <Space>
            <Badge status={endpointStatus.running ? 'success' : 'error'} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              Ontop 端点 {endpointStatus.running ? `运行中 (:${endpointStatus.port})` : '未运行'}
            </span>
          </Space>
        </Header>
        <Content style={{ padding: '16px 24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            style={{ background: '#fff', padding: '16px 24px', borderRadius: 8 }}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
