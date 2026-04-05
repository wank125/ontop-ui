'use client';

/**
 * 语义标注管理页面 — /annotations
 * 独立入口，管理当前激活数据源的全部语义注释。
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Database, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnnotationReviewPanel } from '@/components/annotation-review-panel';
import { datasources, type DataSource } from '@/lib/api';

export default function AnnotationsPage() {
  const [dsList, setDsList]     = useState<DataSource[]>([]);
  const [dsId, setDsId]         = useState<string>('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    datasources.list()
      .then(list => {
        setDsList(list);
        if (list.length > 0) setDsId(list[0].id);
      })
      .catch(e => toast.error('获取数据源失败: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedDs = dsList.find(d => d.id === dsId);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
          <Bot className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">语义标注管理</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            审核 LLM 自动生成的本体语义标注，接受后合并到 active 本体供 AI 查询使用
          </p>
        </div>
      </div>

      {/* Data source selector */}
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="text-sm text-[var(--muted-foreground)]">数据源：</span>
        <Select value={dsId} onValueChange={setDsId} disabled={loading}>
          <SelectTrigger className="w-64 bg-[var(--card)] border-[var(--border)]">
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
        {selectedDs && (
          <span className="text-xs text-[var(--muted-foreground)] font-mono opacity-60">
            {selectedDs.jdbc_url.split('//')[1]?.split('/')[0] ?? ''}
          </span>
        )}
      </div>

      {/* Tips */}
      <Alert className="border-violet-500/20 bg-violet-500/5">
        <Info className="h-4 w-4 text-violet-400" />
        <AlertDescription className="text-xs text-[var(--muted-foreground)]">
          <strong className="text-[var(--foreground)]">工作流说明：</strong>{' '}
          Bootstrap 完成后，LLM 自动为每个类和属性生成语义标注（状态：待审核）。
          逐条审核或批量接受后，点击「合并到本体」将标注写入 active TTL，AI 查询即可利用这些业务语义。
          人工修改的标注在 Bootstrap 重跑时<strong className="text-[var(--foreground)]">不会被覆盖</strong>。
        </AlertDescription>
      </Alert>

      {/* Panel */}
      {dsId ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <AnnotationReviewPanel dsId={dsId} />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          请先选择数据源
        </div>
      )}
    </div>
  );
}
