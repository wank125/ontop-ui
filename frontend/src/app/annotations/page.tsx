'use client';

/**
 * 语义标注管理页面 — /annotations
 * 独立入口，管理当前激活数据源的全部语义注释。
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bot, CheckCircle2, Database, GitMerge, Loader2, Tags, Workflow } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnnotationReviewPanel } from '@/components/annotation-review-panel';
import { annotations, datasources, type AnnotationStats, type DataSource } from '@/lib/api';

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Bot;
}) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="flex items-start justify-between p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnnotationsPage() {
  const [dsList, setDsList]     = useState<DataSource[]>([]);
  const [dsId, setDsId]         = useState<string>('');
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<AnnotationStats>({ pending: 0, accepted: 0, rejected: 0, total: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    datasources.list()
      .then(list => {
        setDsList(list);
        if (list.length > 0) setDsId(list[0].id);
      })
      .catch(e => toast.error('获取数据源失败: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dsId) {
      setStats({ pending: 0, accepted: 0, rejected: 0, total: 0 });
      return;
    }
    setStatsLoading(true);
    annotations.stats(dsId)
      .then(setStats)
      .catch(e => toast.error('获取标注统计失败: ' + e.message))
      .finally(() => setStatsLoading(false));
  }, [dsId]);

  const selectedDs = dsList.find(d => d.id === dsId);
  const hostLabel = selectedDs?.jdbc_url.split('//')[1]?.split('/')[0] ?? '未选择';

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      <div className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[0_24px_80px_-40px_rgba(124,58,237,0.45)] backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
                <Tags className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">语义标注管理</h1>
                <p className="text-sm text-muted-foreground">
                  审核 LLM 生成的本体语义，确认后合并到 active ontology，供 AI 与查询页面复用。
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2">
                <span className="font-medium text-foreground">1. 自动生成</span>
                <div className="mt-1">Bootstrap 后自动创建候选标注</div>
              </div>
              <div className="rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2">
                <span className="font-medium text-foreground">2. 人工审核</span>
                <div className="mt-1">支持逐条编辑、批量接受或拒绝</div>
              </div>
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                <span className="font-medium text-foreground">3. 合并生效</span>
                <div className="mt-1">accepted 标注写入 active TTL，不覆盖人工结果</div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              当前上下文
            </div>
            <div className="space-y-3">
              <Select value={dsId} onValueChange={setDsId} disabled={loading}>
                <SelectTrigger className="w-full bg-[var(--card)] border-[var(--border)]">
                  <SelectValue placeholder="选择数据源…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                  {dsList.map(ds => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Host</div>
                <div className="mt-1 font-mono text-sm text-foreground">{hostLabel}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="当前数据源"
          value={selectedDs?.name ?? '未选择'}
          hint={selectedDs ? '当前审核上下文' : '选择后加载待审核标注'}
          icon={Database}
        />
        <StatCard
          title="待审核"
          value={statsLoading ? '...' : String(stats.pending)}
          hint="需要人工确认的候选标注"
          icon={Workflow}
        />
        <StatCard
          title="已接受"
          value={statsLoading ? '...' : String(stats.accepted)}
          hint="可合并进 active ontology"
          icon={CheckCircle2}
        />
        <StatCard
          title="合并候选"
          value={statsLoading ? '...' : String(stats.total)}
          hint="当前数据源累计标注总数"
          icon={GitMerge}
        />
      </div>

      {/* Panel */}
      {dsId ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <AnnotationReviewPanel dsId={dsId} />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载数据源…
            </span>
          ) : '请先选择数据源'}
        </div>
      )}
    </div>
  );
}
