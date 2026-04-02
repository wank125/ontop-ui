import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Tag, Spin, Collapse } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { aiApi } from '../../api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sparql?: string;
  sql?: string;
  results?: string;
  loading?: boolean;
}

const AIModule: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好！我是 Ontop AI 助手，可以用自然语言查询数据库。试试问我："有哪些门店？" 或 "华东旗舰店有多少员工？"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sparql, setSparql] = useState('');
  const [sql, setSql] = useState('');
  const [results, setResults] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', loading: true }]);
    setLoading(true);
    setSparql('');
    setSql('');
    setResults('');

    try {
      const evtSource = new EventSource(aiApi.queryUrl(question));
      let answer = '';

      evtSource.addEventListener('sparql', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setSparql(data.sparql || '');
      });

      evtSource.addEventListener('executed', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setSql(data.sql || '');
        setResults(data.results || '');
      });

      evtSource.addEventListener('answer', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        answer = data.answer || '';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: answer,
            sparql: sparql || undefined,
            sql: sql || undefined,
            results: results || undefined,
          };
          return updated;
        });
        evtSource.close();
        setLoading(false);
      });

      evtSource.addEventListener('step', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: data.message || '处理中...',
          };
          return updated;
        });
      });

      evtSource.onerror = () => {
        evtSource.close();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '抱歉，查询过程中出现错误。请确认 Ontop 端点正在运行。',
            loading: false,
          };
          return updated;
        });
        setLoading(false);
      };
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '请求失败，请检查后端服务。',
        };
        return updated;
      });
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    '有哪些门店？',
    '华东旗舰店有多少员工？',
    '哪个门店销售额最高？',
    '李四经手的销售总额？',
  ];

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Card
          title={<span><RobotOutlined /> AI 数据助手</span>}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <RobotOutlined style={{ color: '#fff' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: msg.role === 'user' ? '#1677ff' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : '#000',
                }}>
                  {msg.loading ? <Spin size="small" /> : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserOutlined style={{ color: '#fff' }} />
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </Card>

        <div style={{ marginTop: 8 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            {suggestedQuestions.map(q => (
              <Tag key={q} color="blue" style={{ cursor: 'pointer' }} onClick={() => setInput(q)}>{q}</Tag>
            ))}
          </Space>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              size="large"
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={handleSend}
              placeholder="输入你的问题..."
              disabled={loading}
            />
            <Button size="large" type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>
              发送
            </Button>
          </Space.Compact>
        </div>
      </div>

      <Card title={<span><ThunderboltOutlined /> 中间步骤</span>} style={{ width: 350 }} bodyStyle={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        <Collapse
          items={[
            { key: 'sparql', label: 'SPARQL 查询', children: sparql ? <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{sparql}</pre> : '等待查询...' },
            { key: 'sql', label: '重写 SQL', children: sql ? <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{sql}</pre> : '等待执行...' },
            { key: 'results', label: '查询结果', children: results ? <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{results}</pre> : '等待结果...' },
          ]}
          defaultActiveKey={['sparql', 'sql']}
        />
      </Card>
    </div>
  );
};

export default AIModule;
