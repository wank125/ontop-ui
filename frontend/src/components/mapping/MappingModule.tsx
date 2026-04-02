import React, { useState, useEffect } from 'react';
import {
  Card, Select, Table, Button, Modal, Form, Input, Space, message, Tag, Spin,
} from 'antd';
import { CheckCircleOutlined, EditOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { mappingsApi } from '../../api/client';
import type { MappingFileInfo, MappingRule, MappingContent } from '../../types';

const { TextArea } = Input;

const MappingModule: React.FC = () => {
  const [files, setFiles] = useState<MappingFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [content, setContent] = useState<MappingContent | null>(null);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [form] = Form.useForm();

  const loadFiles = async () => {
    try {
      const { data } = await mappingsApi.list();
      setFiles(data);
      if (data.length > 0 && !selectedFile) {
        setSelectedFile(data[0].path);
      }
    } catch { message.error('加载文件列表失败'); }
  };

  const loadContent = async (path: string) => {
    if (!path) return;
    setLoading(true);
    try {
      const { data } = await mappingsApi.content(path);
      setContent(data);
    } catch { message.error('加载映射文件失败'); }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);
  useEffect(() => { if (selectedFile) loadContent(selectedFile); }, [selectedFile]);

  const handleEdit = (rule: MappingRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setEditModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!content || !selectedFile) return;
    const values = await form.validateFields();
    const newMappings = content.mappings.map(m =>
      m.mapping_id === editingRule?.mapping_id ? { ...m, ...values } : m
    );
    const updated = { ...content, mappings: newMappings };
    try {
      await mappingsApi.save(selectedFile, updated);
      setContent(updated);
      setEditModalOpen(false);
      message.success('已保存');
    } catch { message.error('保存失败'); }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    setValidating(true);
    try {
      const { data } = await mappingsApi.validate(selectedFile, {});
      if (data.valid) message.success('映射验证通过！');
      else message.error(`验证失败: ${data.errors?.join(', ')}`);
    } catch { message.error('验证请求失败'); }
    setValidating(false);
  };

  const handleRestart = async () => {
    try {
      await mappingsApi.restartEndpoint({ port: 8080 });
      message.success('端点已重启');
    } catch { message.error('重启失败'); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'mapping_id', key: 'id', width: 150 },
    {
      title: 'Target (RDF模板)',
      dataIndex: 'target', key: 'target', ellipsis: true,
      render: (t: string) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {t.length > 80 ? t.substring(0, 80) + '...' : t}
        </span>
      ),
    },
    {
      title: 'Source (SQL)',
      dataIndex: 'source', key: 'source', ellipsis: true,
      render: (s: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {s.length > 50 ? s.substring(0, 50) + '...' : s}
        </Tag>
      ),
    },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_: any, record: MappingRule) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
      ),
    },
  ];

  return (
    <div>
      <Card
        title="映射编辑器"
        extra={
          <Space>
            <Select
              style={{ width: 300 }}
              placeholder="选择映射文件"
              value={selectedFile || undefined}
              onChange={setSelectedFile}
              options={files.map(f => ({ value: f.path, label: f.filename }))}
            />
            <Button icon={<CheckCircleOutlined />} onClick={handleValidate} loading={validating}>验证</Button>
            <Button icon={<ReloadOutlined />} onClick={handleRestart}>重启端点</Button>
          </Space>
        }
      >
        {content && (
          <>
            <div style={{ marginBottom: 12 }}>
              <strong>Prefixes:</strong>{' '}
              {Object.entries(content.prefixes).map(([k, v]) => (
                <Tag key={k}>{k}: {v}</Tag>
              ))}
            </div>
            <Table
              dataSource={content.mappings}
              columns={columns}
              rowKey="mapping_id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Card>

      <Modal title="编辑映射规则" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={handleSaveRule} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="mapping_id" label="Mapping ID"><Input disabled /></Form.Item>
          <Form.Item name="target" label="Target (RDF 模板)">
            <TextArea rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
          <Form.Item name="source" label="Source (SQL)">
            <TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MappingModule;
