'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  Play,
  Plug,
  RefreshCw,
  Save,
  Server,
  Share2,
  Square,
  Wrench,
  XCircle,
} from 'lucide-react';
import { publishing, type PublishingConfig, type McpStatus } from '@/lib/api';

const MCP_TARGETS = [
  { value: 'claude_desktop', label: 'Claude Desktop' },
  { value: 'cursor', label: 'Cursor / Windsurf' },
];

const SKILLS_FORMATS = [
  { value: 'openai_function', label: 'OpenAI Function' },
  { value: 'anthropic_tool', label: 'Anthropic Tool' },
  { value: 'openapi', label: 'OpenAPI 3.0' },
  { value: 'generic_json', label: 'Generic JSON Schema' },
];

export default function PublishingPage() {
  const [config, setConfig] = useState<PublishingConfig | null>(null);
  const [apiStatus, setApiStatus] = useState<{ status: string; url: string; error?: string } | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [mcpWrench, setMcpWrench] = useState<Array<{ name: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpStarting, setMcpStarting] = useState(false);

  // MCP config snippet
  const [snippetTarget, setSnippetTarget] = useState('claude_desktop');
  const [snippetText, setSnippetText] = useState('');
  const [snippetLoading, setSnippetLoading] = useState(false);

  // Skills
  const [skillsFormat, setSkillsFormat] = useState('openai_function');
  const [skillsText, setSkillsText] = useState('');
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Local config edits
  const [editConfig, setEditConfig] = useState<Partial<PublishingConfig>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, apiSt, mcpSt, tools] = await Promise.all([
        publishing.getConfig(),
        publishing.getApiStatus(),
        publishing.getMcpStatus(),
        publishing.listMcpTools(),
      ]);
      setConfig(cfg);
      setEditConfig(cfg);
      setApiStatus(apiSt);
      setMcpStatus(mcpSt);
      setMcpWrench(tools);
    } catch (e: any) {
      toast.error('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await publishing.updateConfig(editConfig);
      setConfig(updated);
      setEditConfig(updated);
      toast.success('配置已保存');
    } catch (e: any) {
      toast.error('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const { api_key } = await publishing.generateApiKey();
      setConfig(prev => prev ? { ...prev, api_key } : prev);
      setEditConfig(prev => ({ ...prev, api_key }));
      toast.success('API Key 已生成');
    } catch (e: any) {
      toast.error('生成失败: ' + e.message);
    }
  };

  const handleMcpToggle = async () => {
    setMcpStarting(true);
    try {
      if (mcpStatus?.running) {
        const st = await publishing.stopMcp();
        setMcpStatus(st);
        toast.success('MCP 服务已停止');
      } else {
        const st = await publishing.startMcp();
        setMcpStatus(st);
        toast.success('MCP 服务已启动');
      }
    } catch (e: any) {
      toast.error('操作失败: ' + e.message);
    } finally {
      setMcpStarting(false);
    }
  };

  const loadSnippet = async (target: string) => {
    setSnippetLoading(true);
    try {
      const { config: cfg } = await publishing.getMcpConfigSnippet(target);
      setSnippetText(JSON.stringify(cfg, null, 2));
    } catch (e: any) {
      setSnippetText('// 加载失败: ' + e.message);
    } finally {
      setSnippetLoading(false);
    }
  };

  const loadSkills = async (format: string) => {
    setSkillsLoading(true);
    try {
      const data = await publishing.generateSkills(format);
      setSkillsText(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setSkillsText('// 加载失败: ' + e.message);
    } finally {
      setSkillsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制到剪贴板`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const toolCount = mcpWrench.length;
  const formatCount = SKILLS_FORMATS.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)] shadow-sm">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">数据发布</h1>
            <p className="text-sm text-muted-foreground">统一管理当前本体的 API 接入、MCP 配置片段和工具定义导出。</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            API {apiStatus?.status === 'ok' ? '可用' : '异常'}
          </Badge>
          <Badge variant="outline" className="border-border/70 bg-card/70">
            MCP {mcpStatus?.running ? '运行中' : '未启动'}
          </Badge>
          <Button onClick={loadAll} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            {apiStatus?.status === 'ok' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">SPARQL 端点</p>
              <p className="text-sm font-medium">{apiStatus?.status === 'ok' ? '可用' : '不可用'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            {mcpStatus?.running ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Circle className="h-5 w-5 text-[var(--muted-foreground)]" />
            )}
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">MCP 服务</p>
              <p className="text-sm font-medium">{mcpStatus?.running ? '运行中' : '未启动'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Wrench className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">可用工具</p>
              <p className="text-sm font-medium">{toolCount} 个</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Plug className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">支持格式</p>
              <p className="text-sm font-medium">{formatCount} 种</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="api" className="w-full">
        <TabsList className="mb-2 h-auto flex-wrap justify-start gap-2 rounded-xl border border-border/70 bg-card/60 p-1">
          <TabsTrigger value="api" className="gap-2 rounded-lg px-4 py-2">
            <Globe className="mr-2 h-4 w-4" />
            API 接入
          </TabsTrigger>
          <TabsTrigger value="mcp" className="gap-2 rounded-lg px-4 py-2">
            <Server className="mr-2 h-4 w-4" />
            MCP 服务
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2 rounded-lg px-4 py-2">
            <Share2 className="mr-2 h-4 w-4" />
            插件 / Skills
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: API ─────────────────────────── */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API 配置</CardTitle>
              <CardDescription>管理 SPARQL API 的接入密钥和跨域策略</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Enabled */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>启用 API 接入</Label>
                  <p className="text-xs text-[var(--muted-foreground)]">开启后允许外部客户端通过 SPARQL 端点查询</p>
                </div>
                <Switch
                  checked={editConfig.api_enabled ?? true}
                  onCheckedChange={(v) => setEditConfig(prev => ({ ...prev, api_enabled: v }))}
                />
              </div>

              {/* SPARQL Endpoint URL */}
              <div className="space-y-2">
                <Label>SPARQL 端点</Label>
                <div className="flex items-center gap-2">
                  <Input value={apiStatus?.url || ''} readOnly className="font-mono text-sm" />
                  <Badge variant={apiStatus?.status === 'ok' ? 'default' : 'destructive'}>
                    {apiStatus?.status === 'ok' ? '正常' : '异常'}
                  </Badge>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={editConfig.api_key || ''}
                    onChange={(e) => setEditConfig(prev => ({ ...prev, api_key: e.target.value }))}
                    className="font-mono text-sm"
                    placeholder="未设置"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerateKey}>
                    <Key className="mr-1 h-3 w-3" />
                    生成
                  </Button>
                </div>
              </div>

              {/* CORS */}
              <div className="space-y-2">
                <Label>CORS 允许来源</Label>
                <Input
                  value={editConfig.cors_origins || '*'}
                  onChange={(e) => setEditConfig(prev => ({ ...prev, cors_origins: e.target.value }))}
                  placeholder="*"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-[var(--muted-foreground)]">多个来源用逗号分隔，* 表示允许所有</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存配置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: MCP ─────────────────────────── */}
        <TabsContent value="mcp" className="space-y-4">
          {/* MCP Control */}
          <Card>
            <CardHeader>
              <CardTitle>MCP 服务控制</CardTitle>
              <CardDescription>启动/停止内置 MCP Server，支持 Streamable HTTP 传输</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={mcpStatus?.running ? 'default' : 'secondary'}>
                    {mcpStatus?.running ? '运行中' : '已停止'}
                  </Badge>
                  {mcpStatus?.running && (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      传输方式: {mcpStatus.transport}
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleMcpToggle}
                  disabled={mcpStarting}
                  variant={mcpStatus?.running ? 'destructive' : 'default'}
                >
                  {mcpStarting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : mcpStatus?.running ? (
                    <Square className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {mcpStarting ? '处理中...' : mcpStatus?.running ? '停止' : '启动'}
                </Button>
              </div>

              {/* MCP Enabled toggle for auto-start */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>自动启动</Label>
                  <p className="text-xs text-[var(--muted-foreground)]">应用启动时自动运行 MCP Server</p>
                </div>
                <Switch
                  checked={editConfig.mcp_enabled ?? false}
                  onCheckedChange={(v) => setEditConfig(prev => ({ ...prev, mcp_enabled: v }))}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存自动启动配置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Available Wrench */}
          <Card>
            <CardHeader>
              <CardTitle>可用工具</CardTitle>
              <CardDescription>从当前本体自动推导的 MCP 工具</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mcpWrench.map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <code className="text-sm font-semibold">{tool.name}</code>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{tool.description}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                ))}
                {mcpWrench.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">暂无工具（需先配置本体映射）</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Config Snippet */}
          <Card>
            <CardHeader>
              <CardTitle>配置片段</CardTitle>
              <CardDescription>生成目标平台的 MCP 配置，复制到对应配置文件中</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={snippetTarget} onValueChange={(v) => { setSnippetTarget(v); }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {MCP_TARGETS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => loadSnippet(snippetTarget)} disabled={snippetLoading} size="sm">
                  {snippetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  生成
                </Button>
              </div>
              {snippetText && (
                <div className="relative">
                  <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--muted)] p-4 text-xs font-mono">
                    {snippetText}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(snippetText, '配置片段')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Skills / Plugins ──────────────── */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>工具定义生成</CardTitle>
              <CardDescription>
                从当前本体自动推导工具定义，支持多种 LLM / API 框架格式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={skillsFormat} onValueChange={setSkillsFormat}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="选择格式" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILLS_FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => loadSkills(skillsFormat)} disabled={skillsLoading} size="sm">
                  {skillsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  生成预览
                </Button>
              </div>

              {skillsText && (
                <div className="relative">
                  <pre className="max-h-96 overflow-auto rounded-lg bg-[var(--muted)] p-4 text-xs font-mono">
                    {skillsText}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(skillsText, '工具定义')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Format info cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {SKILLS_FORMATS.map(f => (
                  <div
                    key={f.value}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      skillsFormat === f.value
                        ? 'border-[var(--primary)] bg-[var(--accent)]'
                        : 'hover:bg-[var(--accent)]'
                    }`}
                    onClick={() => { setSkillsFormat(f.value); loadSkills(f.value); }}
                  >
                    <p className="text-sm font-medium">{f.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
