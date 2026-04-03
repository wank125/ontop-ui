'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileCode,
  RefreshCw,
  Plus,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
} from 'lucide-react';
import { mappings, type MappingRule, type MappingContent, type MappingFile } from '@/lib/api';

interface Prefix {
  prefix: string;
  iri: string;
}

interface MappingUI {
  id: string;
  mappingId: string;
  target: string;
  source: string;
}

export default function MappingPage() {
  const [files, setFiles] = useState<MappingFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [mappingsUI, setMappingsUI] = useState<MappingUI[]>([]);
  const [prefixes, setPrefixes] = useState<Prefix[]>([]);
  const [rawContent, setRawContent] = useState<MappingContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [showPrefixes, setShowPrefixes] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MappingUI | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const list = await mappings.listFiles();
      setFiles(list);
      if (list.length > 0 && !selectedPath) {
        setSelectedPath(list[0].path);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedPath) loadContent(selectedPath);
  }, [selectedPath]);

  const loadContent = async (path: string) => {
    setLoading(true);
    setValidationResult(null);
    try {
      const content = await mappings.getContent(path);
      setRawContent(content);
      setMappingsUI(
        content.mappings.map((m, i) => ({
          id: String(i),
          mappingId: m.mapping_id,
          target: m.target,
          source: m.source,
        }))
      );
      setPrefixes(
        Object.entries(content.prefixes).map(([prefix, iri]) => ({ prefix, iri }))
      );
    } catch {
      setMappingsUI([]);
      setPrefixes([]);
      setRawContent(null);
    }
    setLoading(false);
  };

  const saveContent = async (newMappings: MappingUI[]) => {
    if (!rawContent || !selectedPath) return;
    setIsSaving(true);
    try {
      await mappings.saveContent(selectedPath, {
        prefixes: rawContent.prefixes,
        mappings: newMappings.map((m) => ({
          mapping_id: m.mappingId,
          target: m.target,
          source: m.source,
        })),
      });
      setMappingsUI(newMappings);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
    setIsSaving(false);
  };

  const handleValidate = async () => {
    if (!selectedPath) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await mappings.validate(selectedPath);
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({ valid: false, errors: [err.message] });
    }
    setIsValidating(false);
  };

  const handleRestart = async () => {
    try {
      await mappings.restartEndpoint();
      alert('端点已重启');
    } catch (err: any) {
      alert(`重启失败: ${err.message}`);
    }
  };

  const handleEditMapping = (mapping: MappingUI) => {
    setEditingMapping({ ...mapping });
    setIsEditDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!editingMapping) return;
    const updated = mappingsUI.map((m) =>
      m.id === editingMapping.id ? editingMapping : m
    );
    await saveContent(updated);
    setIsEditDialogOpen(false);
    setEditingMapping(null);
  };

  const handleAddMapping = async () => {
    const newId = `MAPPING-ID${Date.now()}`;
    const newMapping: MappingUI = {
      id: String(Date.now()),
      mappingId: newId,
      target: '',
      source: '',
    };
    const updated = [...mappingsUI, newMapping];
    await saveContent(updated);
  };

  const handleDeleteMapping = async (id: string) => {
    const updated = mappingsUI.filter((m) => m.id !== id);
    await saveContent(updated);
  };

  const selectedFile = files.find((f) => f.path === selectedPath);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* 页面头部 */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
              <FileCode className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">映射编辑</h1>
              <p className="text-sm text-muted-foreground">管理 OBDA 映射规则</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPath} onValueChange={setSelectedPath}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择映射文件" />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file.path} value={file.path}>
                    {file.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={isValidating || !selectedPath}>
              {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              验证
            </Button>
            <Button size="sm" onClick={handleRestart}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重启端点
            </Button>
          </div>
        </div>

        {/* 验证状态提示 */}
        {validationResult && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg p-3 ${
              validationResult.valid
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {validationResult.valid ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">映射规则验证通过</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  映射规则存在错误: {validationResult.errors.join('; ')}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Prefixes 区域 */}
      {prefixes.length > 0 && (
        <div className="border-b border-border">
          <button
            className="flex w-full items-center gap-2 px-6 py-3 text-left hover:bg-muted/30"
            onClick={() => setShowPrefixes(!showPrefixes)}
          >
            {showPrefixes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-medium">Prefixes 声明</span>
            <Badge variant="secondary" className="ml-2">{prefixes.length}</Badge>
          </button>
          {showPrefixes && (
            <div className="grid grid-cols-5 gap-4 bg-muted/20 px-6 pb-4 pt-1">
              {prefixes.map((p) => (
                <div key={p.prefix} className="rounded-lg bg-card p-2">
                  <div className="font-mono text-xs">
                    <span className="text-primary">{p.prefix}:</span>{' '}
                    <span className="text-muted-foreground">{p.iri}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 映射列表 */}
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">映射规则</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAddMapping} disabled={!selectedPath}>
                <Plus className="mr-2 h-4 w-4" />
                添加映射
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-[140px]">ID</TableHead>
                    <TableHead>Target (RDF 模板)</TableHead>
                    <TableHead>Source (SQL)</TableHead>
                    <TableHead className="w-[100px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappingsUI.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono text-xs">{mapping.mappingId}</TableCell>
                      <TableCell>
                        <ScrollArea className="h-12 max-w-md">
                          <code className="text-xs text-muted-foreground">{mapping.target}</code>
                        </ScrollArea>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{mapping.source}</code>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMapping(mapping)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMapping(mapping.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>编辑映射规则</DialogTitle>
          </DialogHeader>
          {editingMapping && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Mapping ID</Label>
                <Input
                  value={editingMapping.mappingId}
                  onChange={(e) => setEditingMapping({ ...editingMapping, mappingId: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Target (RDF 模板)</Label>
                <Textarea
                  value={editingMapping.target}
                  onChange={(e) => setEditingMapping({ ...editingMapping, target: e.target.value })}
                  className="font-mono text-xs"
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>Source (SQL)</Label>
                <Textarea
                  value={editingMapping.source}
                  onChange={(e) => setEditingMapping({ ...editingMapping, source: e.target.value })}
                  className="font-mono text-xs"
                  rows={2}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveMapping} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
