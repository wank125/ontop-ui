'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  Settings2,
  MessageSquareText,
  Zap,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  Eye,
  EyeOff,
  Server,
  Cpu,
  Globe,
  Sparkles,
} from 'lucide-react';
import { ai, type QuickQuestion } from '@/lib/api';

interface ProviderPreset {
  label: string;
  base_url: string;
  models: string[];
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🤖',
  lm_studio: '🏠',
  ollama: '🦙',
  deepseek: '🔍',
  zhipu: '🧠',
  azure_openai: '☁️',
  anthropic: '🎭',
  custom: '⚙️',
};

export default function SettingsPage() {
  // ── Model Config ──
  const [config, setConfig] = useState<Record<string, any>>({});
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configChanged, setConfigChanged] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});

  // ── Providers ──
  const [providers, setProviders] = useState<Record<string, ProviderPreset>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('lm_studio');

  // ── System Prompt ──
  const [systemPrompt, setSystemPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // ── Quick Questions ──
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<QuickQuestion[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsSaved, setQuestionsSaved] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  const [loading, setLoading] = useState(true);

  // Load all config
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/ai/config').then((r) => r.json()),
      fetch('/api/v1/ai/providers').then((r) => r.json()),
      fetch('/api/v1/ai/system-prompt').then((r) => r.json()),
      fetch('/api/v1/ai/quick-questions').then((r) => r.json()),
    ]).then(([cfg, provs, promptData, qData]) => {
      setConfig(cfg);
      setOriginalConfig(cfg);
      setProviders(provs);
      setSelectedProvider(cfg.llm_provider || 'lm_studio');
      const p = (promptData as any).system_prompt || '';
      setSystemPrompt(p);
      setOriginalPrompt(p);
      const qs = (qData as any).questions || [];
      setQuestions(qs);
      setOriginalQuestions(qs);
      setLoading(false);
    });
  }, []);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const preset = providers[provider];
    if (!preset) return;

    const updates: Record<string, any> = {
      ...config,
      llm_provider: provider,
    };

    // Auto-fill base_url if user hasn't customized it
    if (preset.base_url && (!config.llm_base_url || config.llm_base_url === originalConfig.llm_base_url)) {
      updates.llm_base_url = preset.base_url;
    }

    // Auto-fill model if preset has models
    if (preset.models.length > 0 && (!config.llm_model || config.llm_model === originalConfig.llm_model)) {
      updates.llm_model = preset.models[0];
    }

    setConfig(updates);
    setConfigChanged(true);
  };

  const updateField = (field: string, value: any) => {
    setConfig({ ...config, [field]: value });
    setConfigChanged(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await fetch('/api/v1/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setOriginalConfig(config);
      setConfigChanged(false);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
    setSavingConfig(false);
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await fetch('/api/v1/ai/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      setOriginalPrompt(systemPrompt);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
    setSavingPrompt(false);
  };

  const handleSaveQuestions = async () => {
    setSavingQuestions(true);
    try {
      await fetch('/api/v1/ai/quick-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      setOriginalQuestions(questions);
      setQuestionsSaved(true);
      setTimeout(() => setQuestionsSaved(false), 2000);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
    setSavingQuestions(false);
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    setQuestions([...questions, { id: Date.now().toString(), question: newQuestion.trim() }]);
    setNewQuestion('');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const promptChanged = systemPrompt !== originalPrompt;
  const questionsChanged = JSON.stringify(questions) !== JSON.stringify(originalQuestions);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px - 48px)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentProviderPreset = providers[selectedProvider];

  return (
    <div style={{ height: 'calc(100vh - 56px - 48px)' }} className="overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
            <Settings2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">AI 设置</h1>
            <p className="text-sm text-muted-foreground">模型配置、提示词编辑、快捷问题管理</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="model" className="w-full max-w-3xl">
        <TabsList className="mb-6">
          <TabsTrigger value="model" className="gap-2">
            <Bot className="h-4 w-4" />
            模型设置
          </TabsTrigger>
          <TabsTrigger value="prompt" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            提示词编辑
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2">
            <Zap className="h-4 w-4" />
            快捷问题
          </TabsTrigger>
        </TabsList>

        {/* ── Model Config Tab ── */}
        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">LLM 模型配置</CardTitle>
              <CardDescription>配置用于生成 SPARQL 查询的大语言模型服务</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">服务提供商</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(providers).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handleProviderChange(key)}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors cursor-pointer ${
                        selectedProvider === key

                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border hover:border-primary/50 bg-muted/30'
                      }`}
                    >
                      <span className="text-lg">{PROVIDER_ICONS[key] || '🔌'}</span>
                      <div className="text-left">
                        <span className="text-xs font-medium">{preset.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Base URL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    API Base URL
                  </Label>
                </div>
                <Input
                  value={config.llm_base_url || ''}
                  onChange={(e) => updateField('llm_base_url', e.target.value)}
                  placeholder={currentProviderPreset?.base_url || 'http://localhost:1234/v1'}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {selectedProvider === 'ollama' && 'Ollama 默认: http://localhost:11434/v1'}
                  {selectedProvider === 'lm_studio' && 'LM Studio 默认: http://localhost:1234/v1'}
                  {selectedProvider === 'openai' && 'OpenAI: https://api.openai.com/v1'}
                  {selectedProvider === 'deepseek' && 'DeepSeek: https://api.deepseek.com/v1'}
                  {selectedProvider === 'zhipu' && '智谱: https://open.bigmodel.cn/api/paas/v4'}
                  {selectedProvider === 'anthropic' && 'Anthropic: https://api.anthropic.com'}
                  {!['ollama', 'lm_studio', 'openai', 'deepseek', 'zhipu', 'anthropic'].includes(selectedProvider) && '自定义 OpenAI 兼容 API 地址'}
                </p>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    模型名称
                  </Label>
                </div>
                {currentProviderPreset && currentProviderPreset.models.length > 0 ? (
                  <Select
                    value={currentProviderPreset.models.includes(config.llm_model) ? config.llm_model : 'custom'}
                    onValueChange={(v) => {
                      if (v === 'custom') return;
                      updateField('llm_model', v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProviderPreset.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      <SelectItem value="custom">自定义...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={config.llm_model || ''}
                    onChange={(e) => updateField('llm_model', e.target.value)}
                    placeholder="模型名称，如 gpt-4o-mini"
                    className="font-mono text-sm"
                  />
                )}
                {currentProviderPreset && currentProviderPreset.models.includes(config.llm_model || '') === false && (
                  <Input
                    value={config.llm_model || ''}
                    onChange={(e) => updateField('llm_model', e.target.value)}
                    placeholder="自定义模型名称"
                    className="font-mono text-sm mt-2"
                  />
                )}
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    API Key
                  </Label>
                  {['lm_studio', 'ollama'].includes(selectedProvider) && (
                    <Badge variant="secondary" className="text-[10px]">本地模型可不填</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type={apiKeyVisible ? 'text' : 'password'}
                    value={config.llm_api_key || ''}
                    onChange={(e) => updateField('llm_api_key', e.target.value)}
                    placeholder={selectedProvider === 'lm_studio' ? 'lm-studio' : selectedProvider === 'ollama' ? 'ollama' : 'sk-xxx...'}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={() => setApiKeyVisible(!apiKeyVisible)}>
                    {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Temperature</Label>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{config.llm_temperature ?? 0.1}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.llm_temperature ?? 0.1}
                  onChange={(e) => updateField('llm_temperature', parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>精确 (0)</span>
                  <span>平衡 (0.5)</span>
                  <span>创意 (1)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">最大 Token 数</Label>
                <Select
                  value={String(config.max_tokens ?? 1024)}
                  onValueChange={(v) => updateField('max_tokens', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="256">256 (极速)</SelectItem>
                    <SelectItem value="512">512 (快速)</SelectItem>
                    <SelectItem value="1024">1024 (推荐)</SelectItem>
                    <SelectItem value="2048">2048 (详细)</SelectItem>
                    <SelectItem value="4096">4096 (超长)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Connection Test */}
              <div className="rounded-lg border border-dashed border-border p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">连接提示</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {selectedProvider === 'lm_studio' && (
                    <>
                      <p>1. 确保已启动 LM Studio 并加载了模型</p>
                      <p>2. 在 LM Studio 中开启 Local Server（默认端口 1234）</p>
                      <p>3. API Key 填 <code className="bg-muted px-1 rounded">lm-studio</code> 即可</p>
                    </>
                  )}
                  {selectedProvider === 'ollama' && (
                    <>
                      <p>1. 确保已启动 Ollama 服务（<code className="bg-muted px-1 rounded">ollama serve</code>）</p>
                      <p>2. 确保已拉取模型（<code className="bg-muted px-1 rounded">ollama pull qwen3</code>）</p>
                      <p>3. Ollama 的 OpenAI 兼容端口默认 11434</p>
                    </>
                  )}
                  {selectedProvider === 'openai' && (
                    <>
                      <p>1. 需要有效的 OpenAI API Key</p>
                      <p>2. 注意 API 调用费用</p>
                    </>
                  )}
                  {selectedProvider === 'deepseek' && (
                    <>
                      <p>1. 需要在 <span className="underline">platform.deepseek.com</span> 获取 API Key</p>
                      <p>2. DeepSeek API 兼容 OpenAI 格式</p>
                    </>
                  )}
                  {selectedProvider === 'zhipu' && (
                    <>
                      <p>1. 需要在 <span className="underline">open.bigmodel.cn</span> 获取 API Key</p>
                      <p>2. 兼容 OpenAI 格式，模型名如 glm-4-flash</p>
                    </>
                  )}
                  {selectedProvider === 'anthropic' && (
                    <>
                      <p>1. 需要有效的 Anthropic API Key</p>
                      <p>2. 底层使用 OpenAI 兼容模式调用</p>
                    </>
                  )}
                  {selectedProvider === 'azure_openai' && (
                    <>
                      <p>1. 需要部署 Azure OpenAI 资源</p>
                      <p>2. URL 中替换 {'{resource}'} 和 {'{deployment}'} 占位符</p>
                    </>
                  )}
                  {selectedProvider === 'custom' && (
                    <>
                      <p>1. 填写兼容 OpenAI Chat Completions API 的地址</p>
                      <p>2. 支持 /v1/chat/completions 端点</p>
                    </>
                  )}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSaveConfig} disabled={savingConfig || !configChanged}>
                  {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存配置
                </Button>
                {configChanged && (
                  <Badge variant="outline" className="text-amber-500">未保存</Badge>
                )}
                {configSaved && (
                  <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> 已保存
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setConfig(originalConfig); setConfigChanged(false); setSelectedProvider(originalConfig.llm_provider || 'lm_studio'); }}
                  disabled={!configChanged}
                >
                  撤销修改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── System Prompt Tab ── */}
        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">系统提示词</CardTitle>
              <CardDescription>控制 AI 如何生成 SPARQL 查询的提示词模板</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>SPARQL 生成提示词</Label>
                  <span className="text-xs text-muted-foreground">{systemPrompt.length} 字符</span>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={18}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                  placeholder="输入系统提示词模板..."
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    可用模板变量：<code className="bg-muted px-1 rounded">{'{classes}'}</code>、
                    <code className="bg-muted px-1 rounded">{'{properties}'}</code>、
                    <code className="bg-muted px-1 rounded">{'{relationships}'}</code>、
                    <code className="bg-muted px-1 rounded">{'{prefixes}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    变量会在查询时自动替换为本体实际结构
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSavePrompt} disabled={savingPrompt || !promptChanged}>
                  {savingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存提示词
                </Button>
                {promptChanged && (
                  <Badge variant="outline" className="text-amber-500">未保存</Badge>
                )}
                {promptSaved && (
                  <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> 已保存
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSystemPrompt(originalPrompt)}
                  disabled={!promptChanged}
                >
                  撤销修改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quick Questions Tab ── */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快捷问题</CardTitle>
              <CardDescription>管理 AI 助手聊天界面的快捷问题按钮</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new */}
              <div className="flex gap-2">
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                  placeholder="输入新的快捷问题..."
                  className="flex-1"
                />
                <Button onClick={addQuestion} disabled={!newQuestion.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加
                </Button>
              </div>

              {/* Question list */}
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <span className="flex-1 text-sm">{q.question}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无快捷问题，请添加</p>
                )}
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSaveQuestions} disabled={savingQuestions || !questionsChanged}>
                  {savingQuestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存问题列表
                </Button>
                {questionsChanged && (
                  <Badge variant="outline" className="text-amber-500">未保存</Badge>
                )}
                {questionsSaved && (
                  <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> 已保存
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuestions(originalQuestions)}
                  disabled={!questionsChanged}
                >
                  撤销修改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
