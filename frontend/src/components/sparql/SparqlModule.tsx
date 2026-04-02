import React, { useState, useEffect } from 'react';
import {
  Card, Input, Button, Table, Space, message, Collapse, List, Tag, Spin, Empty,
} from 'antd';
import { PlayCircleOutlined, CodeOutlined, HistoryOutlined } from '@ant-design/icons';
import { sparqlApi } from '../../api/client';
import type { QueryHistoryEntry } from '../../types';

const { TextArea } = Input;

const SparqlModule: React.FC = () => {
  const [query, setQuery] = useState(`PREFIX cls: <http://example.com/retail/>
PREFIX p: <http://example.com/retail/dim_store#>
SELECT ?store ?name ?region WHERE {
  ?store a cls:dim_store ; p:name ?name ; p:region ?region .
}`);
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  const loadHistory = async () => {
    try {
      const { data } = await sparqlApi.history();
      setHistory(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadHistory(); }, []);

  const executeQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSql('');
    try {
      const { data: result } = await sparqlApi.query({ query, format: 'json' });
      const parsed = JSON.parse(result);
      const vars = parsed.head?.vars || [];
      const bindings = parsed.results?.bindings || [];

      setColumns(vars.map((v: string) => ({
        title: v,
        dataIndex: v,
        key: v,
        render: (val: any) => val?.value || '-',
      })));
      setResults(bindings.map((b: any, i: number) => ({ ...b, key: i })));
      message.success(`查询成功，返回 ${bindings.length} 条结果`);
    } catch (e: any) {
      message.error(`查询失败: ${e.response?.data || e.message}`);
    }
    setLoading(false);
    loadHistory();
  };

  const showSql = async () => {
    if (!query.trim()) return;
    try {
      const { data } = await sparqlApi.reformulate(query);
      setSql(data.sql);
    } catch {
      message.error('获取 SQL 失败（需要端点以 --dev 模式启动）');
    }
  };

  const loadFromHistory = (h: QueryHistoryEntry) => {
    setQuery(h.query);
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <Card
          title="SPARQL 查询编辑器"
          extra={
            <Space>
              <Button icon={<PlayCircleOutlined />} type="primary" onClick={executeQuery} loading={loading}>执行</Button>
              <Button icon={<CodeOutlined />} onClick={showSql}>查看 SQL</Button>
            </Space>
          }
        >
          <TextArea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder="输入 SPARQL 查询..."
          />
        </Card>

        {sql && (
          <Card title="重写后的 SQL" style={{ marginTop: 12 }} size="small">
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12, margin: 0 }}>{sql}</pre>
          </Card>
        )}

        <Card title="查询结果" style={{ marginTop: 12 }} size="small">
          {results.length > 0 ? (
            <Table dataSource={results} columns={columns} size="small" pagination={{ pageSize: 20 }} />
          ) : (
            !loading && <Empty description="执行查询后显示结果" />
          )}
        </Card>
      </div>

      <Card title={<span><HistoryOutlined /> 历史查询</span>} style={{ width: 300 }} bodyStyle={{ padding: 8, maxHeight: 600, overflow: 'auto' }}>
        <List
          size="small"
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '4px 8px' }}
              onClick={() => loadFromHistory(item)}
            >
              <div style={{ width: '100%', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.query}
                </div>
                <div style={{ fontSize: 10, color: '#999' }}>
                  {item.timestamp?.split('T')[1]?.split('.')[0]}
                  {item.result_count !== undefined && <Tag style={{ marginLeft: 4, fontSize: 10 }}>{item.result_count}条</Tag>}
                </div>
              </div>
            </List.Item>
          )}
          locale={{ emptyText: '暂无历史' }}
        />
      </Card>
    </div>
  );
};

export default SparqlModule;
