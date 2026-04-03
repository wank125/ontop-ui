'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Code2,
  Play,
  Eye,
  Clock,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { sparql, type QueryHistoryEntry } from '@/lib/api';

interface QueryHistory {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

const defaultQuery = `PREFIX cls: <http://example.com/retail/>
PREFIX p: <http://example.com/retail/dim_store#>
SELECT ?store ?name ?region WHERE {
  ?store a cls:dim_store ;
         p:name ?name ;
         p:region ?region .
}`;

export default function SPARQLPage() {
  const [query, setQuery] = useState(defaultQuery);
  const [isExecuting, setIsExecuting] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [showSQL, setShowSQL] = useState(false);
  const [sqlText, setSqlText] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<QueryHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const entries = await sparql.history();
      setHistory(
        entries.map((e: QueryHistoryEntry) => ({
          id: e.id,
          query: e.query,
          timestamp: new Date(e.timestamp).toLocaleTimeString(),
          resultCount: e.result_count ?? 0,
        }))
      );
    } catch { /* ignore */ }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await sparql.query(query);
      const vars = result.head.vars;
      const bindings = result.results.bindings.map((b) => {
        const row: Record<string, string> = {};
        for (const v of vars) {
          row[v] = b[v]?.value ?? '';
        }
        return row;
      });
      setColumns(vars);
      setRows(bindings);

      // Also get SQL reformulation
      try {
        const { sql } = await sparql.reformulate(query);
        setSqlText(sql);
      } catch { /* ignore */ }

      loadHistory();
    } catch (err: any) {
      setError(err.message);
      setColumns([]);
      setRows([]);
    }
    setIsExecuting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* 页面头部 */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">SPARQL 查询</h1>
              <p className="text-sm text-muted-foreground">执行语义查询语句</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSQL(!showSQL)}
            >
              <Eye className="mr-2 h-4 w-4" />
              查看SQL
            </Button>
            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              className="bg-gradient-to-r from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)] hover:opacity-90"
            >
              {isExecuting ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  执行
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧编辑器区域 */}
        <div className="flex flex-1 flex-col border-r border-border">
          <Tabs defaultValue="editor" className="flex-1">
            <TabsList className="mx-4 mt-2 bg-muted/50">
              <TabsTrigger value="editor">编辑器</TabsTrigger>
              <TabsTrigger value="results">
                结果 {rows.length > 0 && <Badge variant="secondary" className="ml-2">{rows.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="editor" className="flex-1 p-4 pt-2">
              <div className="relative h-full">
                <div className="absolute right-2 top-2 z-10">
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-full w-full resize-none rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  spellCheck={false}
                />
              </div>
            </TabsContent>
            <TabsContent value="results" className="flex-1 p-4 pt-2">
              {error ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="mx-auto mb-3 h-12 w-12 text-destructive opacity-50" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              ) : rows.length > 0 ? (
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">查询结果</CardTitle>
                      <Badge variant="secondary">{rows.length} 条记录</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, i) => (
                          <TableRow key={i}>
                            {columns.map((col) => (
                              <TableCell key={col} className="font-mono text-xs">
                                {row[col]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Code2 className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>执行查询后显示结果</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* SQL 视图 */}
          {showSQL && (
            <div className="border-t border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">重写后的 SQL</span>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 font-mono text-xs">
                {sqlText || '执行查询后显示 SQL'}
              </pre>
            </div>
          )}
        </div>

        {/* 右侧历史面板 */}
        <div className="w-72 border-l border-border">
          <div className="border-b border-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              历史查询
            </h3>
          </div>
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="space-y-2 p-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => setQuery(item.query)}
                >
                  <p className="mb-2 truncate font-mono text-xs">{item.query}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.timestamp}
                    </span>
                    <span>{item.resultCount} 条结果</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
