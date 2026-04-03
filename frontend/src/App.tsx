import React, { useState, useEffect } from 'react';
import { ConfigProvider, Tabs, Layout, Typography, Badge, Space, theme } from 'antd';
import {
  DatabaseOutlined,
  ApartmentOutlined,
  SearchOutlined,
  RobotOutlined,
  ApiOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import DataSourceModule from './components/datasource/DataSourceModule';
import MappingModule from './components/mapping/MappingModule';
import SparqlModule from './components/sparql/SparqlModule';
import AIModule from './components/ai/AIModule';
import OntologyVisualizer from './components/ontology/OntologyVisualizer';
import { sparqlApi } from './api/client';
import type { EndpointStatus } from './types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

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
      label: <span><DatabaseOutlined style={{ marginRight: 6 }} />数据源</span>,
      children: <DataSourceModule />,
    },
    {
      key: 'sparql',
      label: <span><SearchOutlined style={{ marginRight: 6 }} />SPARQL</span>,
      children: <SparqlModule />,
    },
    {
      key: 'mapping',
      label: <span><ApartmentOutlined style={{ marginRight: 6 }} />映射</span>,
      children: <MappingModule />,
    },
    {
      key: 'ai',
      label: <span><RobotOutlined style={{ marginRight: 6 }} />AI</span>,
      children: <AIModule />,
    },
    {
      key: 'ontology',
      label: <span><CodeOutlined style={{ marginRight: 6 }} />可视化</span>,
      children: <OntologyVisualizer />,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#0ea5e9',
          colorBgContainer: '#161c2e',
          colorBgElevated: '#1c2438',
          colorBgLayout: '#0a0e17',
          colorBorder: 'rgba(148, 163, 184, 0.12)',
          colorBorderSecondary: 'rgba(148, 163, 184, 0.08)',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          borderRadius: 8,
          fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 13,
        },
        components: {
          Card: {
            colorBgContainer: '#161c2e',
          },
          Table: {
            colorBgContainer: 'transparent',
            headerBg: '#1c2438',
            rowHoverBg: '#1c2438',
          },
          Button: {
            primaryShadow: '0 0 12px rgba(14, 165, 233, 0.15)',
          },
          Tabs: {
            inkBarColor: '#0ea5e9',
            itemSelectedColor: '#0ea5e9',
            itemHoverColor: '#e2e8f0',
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#0a0e17' }}>
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          height: 56,
          lineHeight: '56px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ApiOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, color: '#e2e8f0', fontSize: 16, fontWeight: 600, lineHeight: '20px' }}>
                Ontop
              </Title>
              <Text style={{ color: '#64748b', fontSize: 11, letterSpacing: '0.04em' }}>
                ONTOLOGY MANAGEMENT
              </Text>
            </div>
          </div>
          <Space size={16} align="center">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 20,
              background: endpointStatus.running ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${endpointStatus.running ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}>
              <Badge status={endpointStatus.running ? 'success' : 'error'} style={{ margin: 0 }} />
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: endpointStatus.running ? '#10b981' : '#ef4444',
                letterSpacing: '0.02em',
              }}>
                {endpointStatus.running ? `:${endpointStatus.port}` : 'OFFLINE'}
              </span>
            </div>
          </Space>
        </Header>
        <Content style={{ padding: '12px 20px 20px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="middle"
            style={{
              background: '#0f1420',
              padding: '12px 20px 20px',
              borderRadius: 12,
              border: '1px solid rgba(148, 163, 184, 0.06)',
            }}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
