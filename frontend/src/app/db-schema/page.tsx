'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Table as TableIcon, Search, Key, Link2 } from 'lucide-react';
import { datasources, type DataSource } from '@/lib/api';

interface Column {
  name: string;
  datatype: string;
  isNullable: boolean;
}

interface ForeignKey {
  from: { columns: string[] };
  to: { relation: string[]; columns: string[] };
}

interface UniqueConstraint {
  isPrimaryKey: boolean;
  determinants: string[];
}

interface Relation {
  name: string[];
  columns: Column[];
  foreignKeys: ForeignKey[];
  uniqueConstraints: UniqueConstraint[];
}

interface DbSchema {
  relations: Relation[];
  metadata: {
    dbmsProductName: string;
    dbmsVersion: string;
  };
}

export default function DbSchemaPage() {
  const [dsList, setDsList] = useState<DataSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [schema, setSchema] = useState<DbSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    datasources.list().then((list) => {
      setDsList(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setSchema(null);
    datasources
      .schema(selectedId)
      .then((data: DbSchema) => setSchema(data))
      .catch(() => setSchema(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const relations = schema?.relations ?? [];
  const meta = schema?.metadata;

  const cleanedRelations = useMemo(() =>
    relations.map((rel) => ({
      ...rel,
      name: rel.name.map((n) => n.replace(/"/g, '')),
      columns: (rel.columns ?? []).map((col) => ({
        ...col,
        name: col.name?.replace(/"/g, '') ?? '',
      })),
      foreignKeys: (rel.foreignKeys ?? []).map((fk) => ({
        from: { columns: (fk.from?.columns ?? []).map((c) => c.replace(/"/g, '')) },
        to: {
          relation: (fk.to?.relation ?? []).map((n) => n.replace(/"/g, '')),
          columns: (fk.to?.columns ?? []).map((c) => c.replace(/"/g, '')),
        },
      })),
      uniqueConstraints: rel.uniqueConstraints ?? [],
    })),
    [relations]
  );

  const filteredRelations = useMemo(() => {
    if (!searchQuery.trim()) return cleanedRelations;
    const q = searchQuery.toLowerCase();
    return cleanedRelations.filter((rel) =>
      rel.name.join('.').toLowerCase().includes(q) ||
      rel.columns.some((col) => col.name.toLowerCase().includes(q))
    );
  }, [cleanedRelations, searchQuery]);

  const totalCols = cleanedRelations.reduce((sum, rel) => sum + rel.columns.length, 0);
  const totalFks = cleanedRelations.reduce((sum, rel) => sum + rel.foreignKeys.length, 0);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* Header */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
              <TableIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">数据库概览</h1>
              <p className="text-sm text-muted-foreground">表结构与关系浏览</p>
            </div>
          </div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="选择数据源" />
            </SelectTrigger>
            <SelectContent>
              {dsList.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  {ds.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search bar */}
      {schema && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索表名或列名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 pl-9"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !schema ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="text-center">
              <TableIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>选择数据源查看表结构</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stats */}
            <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{filteredRelations.length} 张表</span>
              <span>·</span>
              <span>共 {totalCols} 列 · {totalFks} 个外键</span>
              <span>·</span>
              <span>{meta?.dbmsProductName} {meta?.dbmsVersion}</span>
            </div>

            {/* Tables */}
            {filteredRelations.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>未找到匹配的表</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-1.5">
                {filteredRelations.map((rel, idx) => {
                  const tableName = rel.name.join('.');
                  const pk = rel.uniqueConstraints.find((c) => c.isPrimaryKey);
                  const pkCols = pk?.determinants.map((d) => d.replace(/"/g, '')) ?? [];
                  const fks = rel.foreignKeys;

                  return (
                    <AccordionItem key={idx} value={tableName} className="rounded-lg border border-border bg-card">
                      <AccordionTrigger className="px-4 py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-medium">{tableName}</code>
                          <Badge variant="secondary" className="text-[10px]">
                            {rel.columns.length} 列
                          </Badge>
                          {fks.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {fks.length} FK
                            </Badge>
                          )}
                          {pkCols.length > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                              PK
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                              <th className="pb-1.5 pr-3 font-medium">列名</th>
                              <th className="pb-1.5 pr-3 font-medium">类型</th>
                              <th className="pb-1.5 pr-3 font-medium">可空</th>
                              <th className="pb-1.5 font-medium">约束</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rel.columns.map((col, ci) => {
                              const isPk = pkCols.includes(col.name);
                              const fkRef = fks.find((fk) =>
                                fk.from.columns.includes(col.name)
                              );
                              return (
                                <tr key={ci} className="border-b border-border/50 last:border-0">
                                  <td className="py-1.5 pr-3 font-mono">
                                    {isPk && <Key className="inline-block mr-1 h-3 w-3 text-amber-500" />}
                                    {col.name}
                                  </td>
                                  <td className="py-1.5 pr-3 text-muted-foreground">{col.datatype}</td>
                                  <td className="py-1.5 pr-3">
                                    {col.isNullable ? (
                                      <span className="text-muted-foreground/50">YES</span>
                                    ) : (
                                      <span className="text-muted-foreground">NO</span>
                                    )}
                                  </td>
                                  <td className="py-1.5">
                                    {fkRef && (
                                      <Badge variant="outline" className="text-[10px]">
                                        <Link2 className="mr-1 h-2.5 w-2.5" />
                                        FK → {fkRef.to.relation.join('.')}
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
