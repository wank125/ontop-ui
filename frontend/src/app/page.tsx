'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Code2,
  FileCode,
  Bot,
  GitGraph,
  Table,
  Zap,
  Server,
  Loader2,
  ArrowRight,
  Activity,
  FileText,
  Layers,
  CircleCheck,
  CircleX,
  Brain,
  Search,
  Cpu,
  Globe,
} from 'lucide-react';
import { datasources, mappings, sparql, ontology, type QuickQuestion } from '@/lib/api';

// ── Quick Start Card Data ──────────────────────────────
const featureCards = [
  {
    title: '数据源管理',
    description: '多数据库连接管理，支持 PostgreSQL、MySQL、Oracle、SQL Server，一键测试连接与 Schema 提取',
    icon: Database,
    href: '/datasource',
    color: 'from-sky-500 to-blue-600',
    bgColor: 'bg-sky-500/10',
    textColor: 'text-sky-400',
  },
  {
    title: '数据库概览',
    description: '表结构浏览、主外键分析、依赖检测与建模评估',
    icon: Table,
    href: '/db-schema',
    color: 'from-teal-500 to-cyan-600',
    bgColor: 'bg-teal-500/10',
    textColor: 'text-teal-400',
  },
  {
    title: 'SPARQL 查询',
    description: '语义查询执行、SQL 重写查看、多格式结果导出与查询历史管理',
    icon: Code2,
    href: '/sparql',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-400',
  },
  {
    title: '映射编辑',
    description: 'OBDA 映射规则增删改查、映射验证、端点管理与热重启',
    icon: FileCode,
    href: '/mapping',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
  },
  {
    title: 'AI 助手',
    description: '自然语言转 SPARQL，流式生成查询结果与 AI 智能解答，支持 8 种 LLM 提供商',
    icon: Bot,
    href: '/ai-assistant',
    color: 'from-fuchsia-500 to-pink-600',
    bgColor: 'bg-fuchsia-500/10',
    textColor: 'text-fuchsia-400',
  },
  {
    title: '本体可视化',
    description: 'TTL 本体文件查看，类与属性层级浏览，物理模拟关系图谱',
    icon: GitGraph,
    href: '/ontology',
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
  },
];

// ── Workflow Steps ─────────────────────────────────────
const workflowSteps = [
  { step: 1, title: '连接数据源', desc: '配置数据库连接', href: '/datasource' },
  { step: 2, title: '探测结构', desc: '浏览表与依赖', href: '/db-schema' },
  { step: 3, title: 'Bootstrap', desc: '自动生成映射', href: '/datasource' },
  { step: 4, title: '编辑映射', desc: '精调映射规则', href: '/mapping' },
  { step: 5, title: '语义查询', desc: 'SPARQL / AI 问答', href: '/sparql' },
];

// ── Architecture Layers ────────────────────────────────
const archLayers = [
  {
    label: '数据层',
    items: [
      { icon: Database, name: 'PostgreSQL' },
      { icon: Database, name: 'MySQL' },
      { icon: Database, name: 'Oracle' },
      { icon: Database, name: 'SQL Server' },
    ],
  },
  {
    label: '语义层',
    items: [
      { icon: Layers, name: 'Ontop VKG 引擎' },
      { icon: FileCode, name: 'OBDA 映射规则' },
      { icon: FileText, name: 'OWL 本体文件' },
      { icon: Cpu, name: 'SPARQL→SQL 重写' },
    ],
  },
  {
    label: '应用层',
    items: [
      { icon: Code2, name: 'SPARQL 查询' },
      { icon: Bot, name: 'AI 智能问答' },
      { icon: GitGraph, name: '本体可视化' },
      { icon: Search, name: '数据浏览' },
    ],
  },
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [endpointRunning, setEndpointRunning] = useState(false);
  const [endpointPort, setEndpointPort] = useState(8080);
  const [dsCount, setDsCount] = useState(0);
  const [mappingCount, setMappingCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    Promise.all([
      datasources.list().catch(() => []),
      mappings.listFiles().catch(() => []),
      sparql.history().catch(() => []),
      sparql.endpointStatus().catch(() => ({ running: false, port: 8080 })),
    ]).then(async ([dsList, mappingFiles, history, endpoint]) => {
      setDsCount((dsList as any[]).length);
      setMappingCount((mappingFiles as any[]).length);
      setHistoryCount((history as any[]).length);
      setEndpointRunning((endpoint as any).running);
      setEndpointPort((endpoint as any).port || 8080);

      // Enrich: get class count from first ontology file
      try {
        const ontFiles = await ontology.listFiles();
        if ((ontFiles as any[]).length > 0) {
          const content = await ontology.getContent((ontFiles as any[])[0].path);
          setClassCount((content as any).classes?.length || 0);
        }
      } catch {
        // ignore
      }

      setLoading(false);
    });
  }, []);

  // ── Stat Cards Config ──
  const statCards = [
    { label: '数据源', value: dsCount, icon: Database, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: '映射文件', value: mappingCount, icon: FileCode, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: '本体类', value: classCount, icon: GitGraph, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '查询历史', value: historyCount, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8" style={{ minHeight: 'calc(100vh - 56px - 48px)' }}>
      {/* ── Section 1: Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60">
        {/* Background gradient + grid pattern */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 20% 50%, oklch(0.25 0.08 280), transparent 50%), radial-gradient(ellipse at 80% 50%, oklch(0.20 0.06 200), transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(0.70 0.15 280) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Decorative blur orb */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[oklch(0.70_0.15_280)] opacity-[0.08] blur-3xl" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)] shadow-lg">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">天织语义平台</h1>
              <p className="gradient-text text-lg font-medium mt-1">Ontop 虚拟知识图谱管理与语义数据查询</p>
              <p className="text-sm text-muted-foreground mt-1">
                基于 OBDA/R2RML 映射，将关系数据库透明地暴露为语义层
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : endpointRunning ? (
              <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                语义端点运行中 :{endpointPort}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1">
                <CircleX className="h-3 w-3" />
                语义端点已停止
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Status Metrics ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1 tabular-nums">
                      {loading ? (
                        <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Section 3: Feature Cards ── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">核心能力</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="group block">
                <Card className="h-full border-border/60 transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-md group-hover:shadow-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} shadow-sm`}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{card.title}</h3>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Workflow Guide ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">快速开始</CardTitle>
          <CardDescription>从数据库到语义查询的推荐工作流</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-stretch gap-2">
            {workflowSteps.map((ws, i) => (
              <div key={ws.step} className="flex items-center gap-2 flex-1">
                <Link
                  href={ws.href}
                  className="flex flex-1 items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/60 hover:border-primary/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)] text-xs font-bold text-white">
                    {ws.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ws.title}</p>
                    <p className="text-[11px] text-muted-foreground">{ws.desc}</p>
                  </div>
                </Link>
                {i < workflowSteps.length - 1 && (
                  <ArrowRight className="hidden md:block h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Architecture Overview ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">架构概览</CardTitle>
          <CardDescription>天织基于 Ontop VKG 引擎的三层语义架构</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {archLayers.map((layer, li) => (
              <div key={layer.label} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      li === 0 ? 'bg-sky-400' : li === 1 ? 'bg-violet-400' : 'bg-emerald-400'
                    }`}
                  />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {layer.label}
                  </h4>
                </div>
                <div className="space-y-2">
                  {layer.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5"
                      >
                        <ItemIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
                {li < archLayers.length - 1 && (
                  <div className="hidden md:flex items-center justify-center absolute right-[-12px] top-1/2 -translate-y-1/2">
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Flow arrows between columns (visible on md+) */}
          <div className="hidden md:flex items-center justify-center gap-8 mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>关系数据库</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span>OBDA 映射</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span>SPARQL 语义查询</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span>AI 自然语言</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
