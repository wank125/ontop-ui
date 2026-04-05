'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  GitMerge,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  datasources,
  suggestions as sugApi,
  type DataSource,
  type OntologySuggestion,
  type SuggestionStatus,
  type SuggestionStats,
} from '@/lib/api';

// ── Constants ─────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  RENAME_CLASS:    '重命名类',
  RENAME_PROPERTY: '重命名属性',
  ADD_SUBCLASS:    '添加子类关系',
  REFINE_TYPE:     '精化数据类型',
  ADD_LABEL:       '补充中文标注',
};

const PRIORITY_STYLE: Record<string, string> = {
  high:   'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low:    'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const PRIORITY_TEXT: Record<string, string> = {
  high: '高', medium: '中', low: '低',
};

const STATUS_STYLE: Record<SuggestionStatus, string> = {
  pending:  'border-sky-500/30 bg-sky-500/10 text-sky-400',
  accepted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-400',
  applied:  'border-violet-500/30 bg-violet-500/10 text-violet-400',
};

const STATUS_TEXT: Record<SuggestionStatus, string> = {
  pending: '待处理', accepted: '已接受', rejected: '已拒绝', applied: '已应用',
};

// ── Main Component ─────────────────────────────────────────

export default function OntologySuggestionsPage() {
  const [dsList, setDsList]     = useState<DataSource[]>([]);
  const [dsId, setDsId]         = useState('');
  const [items, setItems]       = useState<OntologySuggestion[]>([]);
  const [stats, setStats]       = useState<SuggestionStats>({ pending: 0, accepted: 0, rejected: 0, applied: 0, total: 0 });
  const [loading, setLoading]   = useState(false);
  const [analyzing, setAnalyze] = useState(false);
  const [applying, setApplying] = useState(false);
  const [filterStatus, setFilter] = useState<SuggestionStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    datasources.list().then(l => {
      setDsList(l);
      if (l.length) setDsId(l[0].id);
    }).catch(e => toast.error('获取数据源失败: ' + e.message));
  }, []);

  const load = useCallback(async () => {
    if (!dsId) return;
    setLoading(true);
    try {
      const [s, st] = await Promise.all([
        sugApi.list(dsId, filterStatus === 'all' ? {} : { status: filterStatus }),
        sugApi.stats(dsId),
      ]);
      setItems(s);
      setStats(st);
    } catch (e: any) {
      toast.error('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dsId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleAnalyze = async () => {
    setAnalyze(true);
    try {
      await sugApi.analyze(dsId);
      toast.success('分析任务已启动（后台运行，约 30s 后刷新查看）');
      setTimeout(load, 35000);
    } catch (e: any) {
      toast.error('分析失败: ' + e.message);
    } finally {
      setAnalyze(false);
    }
  };

  const handleStatus = async (sug: OntologySuggestion, status: SuggestionStatus) => {
    try {
      await sugApi.updateStatus(dsId, sug.id, status);
      toast.success(`已${STATUS_TEXT[status]}`);
      await load();
    } catch (e: any) {
      toast.error('操作失败: ' + e.message);
    }
  };

  const handleApply = async (sug: OntologySuggestion) => {
    try {
      const res = await sugApi.apply(dsId, sug.id);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
      await load();
    } catch (e: any) {
      toast.error('应用失败: ' + e.message);
    }
  };

  const handleBatchApply = async () => {
    setApplying(true);
    try {
      const res = await sugApi.batchApply(dsId);
      toast.success(`批量应用完成：成功 ${res.applied} 条，跳过 ${res.skipped} 条`);
      await load();
    } catch (e: any) {
      toast.error('批量应用失败: ' + e.message);
    } finally {
      setApplying(false);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const acceptedCount = items.filter(s => s.status === 'accepted' && s.auto_apply).length;

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20">
          <Wand2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">本体精化建议</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            LLM 分析本体结构，给出命名、类型、层次改进建议并支持自动应用
          </p>
        </div>
      </div>

      {/* DS selector */}
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="text-sm text-[var(--muted-foreground)]">数据源：</span>
        <Select value={dsId} onValueChange={setDsId}>
          <SelectTrigger className="w-64 bg-[var(--card)] border-[var(--border)]">
            <SelectValue placeholder="选择数据源…" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--card)] border-[var(--border)]">
            {dsList.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tips */}
      <Alert className="border-violet-500/20 bg-violet-500/5">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <AlertDescription className="text-xs text-[var(--muted-foreground)]">
          <strong className="text-[var(--foreground)]">使用说明：</strong>{' '}
          先完成注释审核（/annotations），再点击「AI 分析」生成精化建议。
          可逐条接受/拒绝，接受后点「批量应用」将 RENAME/REFINE_TYPE 类建议自动写入 TTL。
          <strong className="text-[var(--foreground)]"> ADD_SUBCLASS 需人工操作。</strong>
        </AlertDescription>
      </Alert>

      {/* Stats + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          {[
            { label: '全部', value: stats.total,    style: 'text-[var(--foreground)]' },
            { label: '待处理', value: stats.pending,  style: 'text-sky-400' },
            { label: '已接受', value: stats.accepted, style: 'text-emerald-400' },
            { label: '已拒绝', value: stats.rejected, style: 'text-red-400' },
            { label: '已应用', value: stats.applied,  style: 'text-violet-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
              <span className={`text-base font-bold ${s.style}`}>{s.value}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {acceptedCount > 0 && (
            <Button
              variant="outline" size="sm"
              onClick={handleBatchApply}
              disabled={applying}
              className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            >
              {applying
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <Zap className="h-4 w-4 mr-1.5" />
              }
              批量应用（{acceptedCount}条）
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing || !dsId}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
          >
            {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            AI 分析
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-0">
        {(['all', 'pending', 'accepted', 'rejected', 'applied'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-t-md transition-colors border-b-2 -mb-px ${
              filterStatus === s
                ? 'border-violet-500 text-[var(--foreground)] font-medium'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {s === 'all' ? '全部' : STATUS_TEXT[s as SuggestionStatus]}
          </button>
        ))}
      </div>

      {/* Suggestion List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-[var(--muted-foreground)]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />加载中…
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] text-sm">
          <Wand2 className="h-8 w-8 opacity-30" />
          {stats.total === 0
            ? '暂无建议，点击「AI 分析」生成本体精化建议'
            : '没有符合条件的建议'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(sug => (
            <div
              key={sug.id}
              className={`rounded-xl border bg-[var(--card)] overflow-hidden transition-all ${
                sug.status === 'applied' ? 'opacity-60' : ''
              }`}
              style={{ borderColor: sug.priority === 'high' ? 'rgb(239 68 68 / 0.2)' : 'var(--border)' }}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--muted)]/20"
                onClick={() => toggleExpand(sug.id)}
              >
                {expanded.has(sug.id)
                  ? <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                }

                {/* Type badge */}
                <Badge variant="outline" className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] flex-shrink-0">
                  {TYPE_LABEL[sug.type] || sug.type}
                </Badge>

                {/* Summary */}
                <code className="text-sm font-mono text-red-400 line-through mr-1">{sug.current_val}</code>
                <span className="text-[var(--muted-foreground)] text-sm">→</span>
                <code className="text-sm font-mono text-emerald-400 ml-1">{sug.proposed_val}</code>

                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                  {/* Priority */}
                  <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[sug.priority]}`}>
                    {PRIORITY_TEXT[sug.priority]}优先
                  </Badge>
                  {/* Auto-apply indicator */}
                  {sug.auto_apply && (
                    <Badge variant="outline" className="text-[10px] border-sky-500/30 bg-sky-500/10 text-sky-400">
                      <Zap className="h-2.5 w-2.5 mr-0.5" />自动
                    </Badge>
                  )}
                  {/* Status */}
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[sug.status]}`}>
                    {STATUS_TEXT[sug.status]}
                  </Badge>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {sug.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatus(sug, 'accepted')}
                          className="flex h-7 items-center gap-1 px-2 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" /> 接受
                        </button>
                        <button
                          onClick={() => handleStatus(sug, 'rejected')}
                          className="flex h-7 items-center gap-1 px-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-colors"
                        >
                          <XCircle className="h-3 w-3" /> 拒绝
                        </button>
                      </>
                    )}
                    {sug.status === 'accepted' && sug.auto_apply && (
                      <button
                        onClick={() => handleApply(sug)}
                        className="flex h-7 items-center gap-1 px-2 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 text-xs transition-colors"
                      >
                        <Zap className="h-3 w-3" /> 应用
                      </button>
                    )}
                    {sug.status === 'accepted' && !sug.auto_apply && (
                      <span className="text-[11px] text-amber-400 px-1">需人工操作</span>
                    )}
                    {(sug.status === 'rejected' || sug.status === 'applied') && (
                      <button
                        onClick={() => handleStatus(sug, 'pending')}
                        className="flex h-7 items-center gap-1 px-2 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] text-xs transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" /> 重置
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded reason */}
              {expanded.has(sug.id) && (
                <div className="px-4 pb-3 pt-0 border-t border-[var(--border)] bg-[var(--muted)]/10">
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">{sug.reason}</p>
                  {sug.type === 'ADD_SUBCLASS' && (
                    <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                      <p className="text-[11px] text-amber-400 font-medium mb-1">人工操作指引</p>
                      <code className="text-[11px] font-mono text-[var(--foreground)]">
                        :{sug.current_val} rdfs:subClassOf :{sug.proposed_val} .
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
