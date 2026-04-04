'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Database,
  Code2,
  FileCode,
  Bot,
  GitGraph,
  Settings,
  Zap,
  Server,
  CircleCheck,
  CircleX,
  ChevronUp,
  ChevronDown,
  Activity,
  Clock,
  Table,
} from 'lucide-react';
import { sparql, mappings } from '@/lib/api';

const navItems = [
  { title: '数据源管理', href: '/datasource', icon: Database, description: '管理数据库连接' },
  { title: '数据库概览', href: '/db-schema', icon: Table, description: '浏览表结构' },
  { title: 'SPARQL 查询', href: '/sparql', icon: Code2, description: '执行语义查询' },
  { title: '映射编辑', href: '/mapping', icon: FileCode, description: '编辑 OBDA 映射' },
  { title: 'AI 助手', href: '/ai-assistant', icon: Bot, description: '自然语言查询' },
  { title: '本体可视化', href: '/ontology', icon: GitGraph, description: '可视化数据模型' },
];

interface EndpointStatus {
  status: 'running' | 'stopped' | 'error';
  port: number;
}

export function SidebarNav() {
  const pathname = usePathname();
  const [showEndpointDetails, setShowEndpointDetails] = useState(false);
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>({
    status: 'stopped',
    port: 8080,
  });
  const [restarting, setRestarting] = useState(false);

  const checkStatus = async () => {
    try {
      const { running, port } = await sparql.endpointStatus();
      setEndpointStatus({ status: running ? 'running' : 'stopped', port });
    } catch {
      setEndpointStatus({ status: 'error', port: 8080 });
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await mappings.restartEndpoint();
      await checkStatus();
    } catch { /* ignore */ }
    setRestarting(false);
  };

  const getStatusConfig = () => {
    switch (endpointStatus.status) {
      case 'running':
        return {
          icon: CircleCheck,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          pulse: 'bg-emerald-500',
          label: '运行中',
          gradient: 'from-emerald-500 to-teal-500',
        };
      case 'stopped':
        return {
          icon: CircleX,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          pulse: 'bg-amber-500',
          label: '已停止',
          gradient: 'from-amber-500 to-orange-500',
        };
      case 'error':
        return {
          icon: CircleX,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          pulse: 'bg-red-500',
          label: '异常',
          gradient: 'from-red-500 to-rose-500',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
      {/* Logo 区域 */}
      <div className="flex h-16 items-center gap-3 border-b border-[var(--sidebar-border)] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--sidebar-foreground)]">天织</h1>
          <p className="text-xs text-[var(--muted-foreground)]">语义平台</p>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive
                      ? 'text-[var(--sidebar-primary)]'
                      : 'text-[var(--muted-foreground)] group-hover:text-[var(--sidebar-foreground)]'
                  )}
                />
                <div className="flex-1">
                  <div>{item.title}</div>
                  <div className="text-xs text-[var(--muted-foreground)] opacity-70">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 底部状态栏 */}
      <div className="border-t border-[var(--sidebar-border)]">
        <button
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--sidebar-accent)]"
          onClick={() => setShowEndpointDetails(!showEndpointDetails)}
        >
          <div className="relative">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', statusConfig.bg)}>
              <Server className={cn('h-5 w-5', statusConfig.color)} />
            </div>
            {endpointStatus.status === 'running' && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', statusConfig.pulse)} />
                <span className={cn('relative inline-flex rounded-full h-3 w-3', statusConfig.pulse)} />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[var(--sidebar-foreground)]">语义端点</p>
              {showEndpointDetails ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', statusConfig.pulse)} />
              <p className={cn('text-xs', statusConfig.color)}>{statusConfig.label}</p>
              <span className="text-xs text-muted-foreground">:{endpointStatus.port}</span>
            </div>
          </div>
        </button>

        {showEndpointDetails && (
          <div className="border-t border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/50 px-4 py-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">状态</p>
                  <p className="font-medium text-foreground">{statusConfig.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">端口</p>
                  <p className="font-medium text-foreground">{endpointStatus.port}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  restarting ? 'opacity-50' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                )}
                onClick={handleRestart}
                disabled={restarting}
              >
                <CircleCheck className="h-3 w-3" />
                {restarting ? '重启中...' : '重启'}
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors bg-muted text-muted-foreground hover:bg-muted/80"
                onClick={checkStatus}
              >
                <Activity className="h-3 w-3" />
                检测
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 设置按钮 */}
      <div className="border-t border-[var(--sidebar-border)] p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]">
          <Settings className="h-4 w-4" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
