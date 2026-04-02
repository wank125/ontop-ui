import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, message, Tree, Steps, Spin, Tag,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined, LinkOutlined,
} from '@ant-design/icons';
import { datasourcesApi } from '../../api/client';
import type { DataSource, DataSourceForm } from '../../types';

const DataSourceModule: React.FC = () => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [bootstrapModalOpen, setBootstrapModalOpen] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [bootstrapStep, setBootstrapStep] = useState(0);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [form] = Form.useForm();
  const [bootstrapForm] = Form.useForm();

  const loadSources = async () => {
    setLoading(true);
    try {
      const { data } = await datasourcesApi.list();
      setSources(data);
    } catch { message.error('加载数据源失败'); }
    setLoading(false);
  };

  useEffect(() => { loadSources(); }, []);

  const handleCreate = async (values: DataSourceForm) => {
    try {
      await datasourcesApi.create(values);
      message.success('数据源已添加');
      setModalOpen(false);
      form.resetFields();
      loadSources();
    } catch { message.error('添加失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await datasourcesApi.delete(id);
      message.success('已删除');
      loadSources();
    } catch { message.error('删除失败'); }
  };

  const handleTest = async (id: string) => {
    try {
      const { data } = await datasourcesApi.test(id);
      if (data.connected) message.success('连接成功！');
      else message.error(`连接失败: ${data.message}`);
    } catch { message.error('测试失败'); }
  };

  const handleViewSchema = async (id: string) => {
    setSelectedId(id);
    try {
      const { data } = await datasourcesApi.schema(id);
      setSchemaData(data);
      setSchemaModalOpen(true);
    } catch { message.error('获取 Schema 失败'); }
  };

  const handleBootstrap = async () => {
    const values = await bootstrapForm.validateFields();
    setBootstrapLoading(true);
    setBootstrapStep(1);
    try {
      const { data } = await datasourcesApi.bootstrap(selectedId, values);
      setBootstrapStep(2);
      message.success('Bootstrap 成功！');
      console.log('Bootstrap result:', data);
    } catch (e: any) {
      setBootstrapStep(0);
      message.error(`Bootstrap 失败: ${e.response?.data?.detail || e.message}`);
    }
    setBootstrapLoading(false);
  };

  const openBootstrap = (id: string) => {
    setSelectedId(id);
    setBootstrapStep(0);
    bootstrapForm.resetFields();
    setBootstrapModalOpen(true);
  };

  const buildSchemaTree = (data: any) => {
    if (!data) return [];
    const relations = data.relations || [];
    return relations.map((r: any) => ({
      title: (
        <span>
          <Tag color="blue">{r.name?.map((n: any) => n.value || n).join('.') || 'unknown'}</Tag>
          <span style={{ color: '#999', fontSize: 12 }}>({r.columns?.length || 0} 列)</span>
        </span>
      ),
      key: r.name?.join('.'),
      children: (r.columns || []).map((c: any) => ({
        title: (
          <span>
            {c.name?.value || c.name}
            <Tag style={{ marginLeft: 4 }}>{c.datatype}</Tag>
            {c.isNullable ? <Tag color="orange">nullable</Tag> : <Tag color="green">NOT NULL</Tag>}
          </span>
        ),
        key: `${r.name?.join('.')}.${c.name}`,
        isLeaf: true,
      })),
    }));
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'JDBC URL', dataIndex: 'jdbc_url', key: 'jdbc_url', ellipsis: true },
    { title: '用户', dataIndex: 'user', key: 'user' },
    { title: '驱动', dataIndex: 'driver', key: 'driver' },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: DataSource) => (
        <Space>
          <Button size="small" icon={<LinkOutlined />} onClick={() => handleTest(record.id)}>测试</Button>
          <Button size="small" onClick={() => handleViewSchema(record.id)}>Schema</Button>
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} onClick={() => openBootstrap(record.id)}>Bootstrap</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="数据源管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加数据源</Button>}
      >
        <Table dataSource={sources} columns={columns} rowKey="id" loading={loading} />
      </Card>

      {/* Add Data Source Modal */}
      <Modal title="添加数据源" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="My Database" /></Form.Item>
          <Form.Item name="jdbc_url" label="JDBC URL" rules={[{ required: true }]}>
            <Input placeholder="jdbc:postgresql://localhost:5433/mydb" />
          </Form.Item>
          <Form.Item name="user" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="driver" label="驱动" initialValue="org.postgresql.Driver">
            <Select options={[
              { value: 'org.postgresql.Driver', label: 'PostgreSQL' },
              { value: 'com.mysql.cj.jdbc.Driver', label: 'MySQL' },
              { value: 'com.microsoft.sqlserver.jdbc.SQLServerDriver', label: 'SQL Server' },
              { value: 'oracle.jdbc.OracleDriver', label: 'Oracle' },
            ]} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" block>添加</Button></Form.Item>
        </Form>
      </Modal>

      {/* Schema Viewer Modal */}
      <Modal title="数据库 Schema" open={schemaModalOpen} onCancel={() => setSchemaModalOpen(false)} width={600} footer={null}>
        {schemaData && <Tree treeData={buildSchemaTree(schemaData)} defaultExpandAll />}
      </Modal>

      {/* Bootstrap Wizard Modal */}
      <Modal title="Bootstrap 自动生成" open={bootstrapModalOpen} onCancel={() => setBootstrapModalOpen(false)} footer={null} width={500}>
        <Steps current={bootstrapStep} items={[{ title: '配置' }, { title: '执行' }, { title: '完成' }]} style={{ marginBottom: 24 }} />
        {bootstrapStep === 0 && (
          <Form form={bootstrapForm} layout="vertical">
            <Form.Item name="base_iri" label="Base IRI" initialValue="http://example.com/ontop/" rules={[{ required: true }]}>
              <Input placeholder="http://example.com/ontop/" />
            </Form.Item>
            <Button type="primary" onClick={handleBootstrap} loading={bootstrapLoading} block>
              <ThunderboltOutlined /> 执行 Bootstrap
            </Button>
          </Form>
        )}
        {bootstrapStep === 1 && <Spin tip="正在生成本体和映射..." style={{ display: 'block', margin: '40px auto' }} />}
        {bootstrapStep === 2 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Tag color="success" style={{ fontSize: 16, padding: '8px 16px' }}>生成成功！</Tag>
            <p style={{ marginTop: 12 }}>本体文件和映射规则已自动生成，可在"映射编辑"模块中查看和修改。</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DataSourceModule;
