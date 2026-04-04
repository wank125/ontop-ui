'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreVertical,
  Pencil,
  Eye,
  RefreshCw,
  Trash2,
  Database,
  Search,
  Filter,
  Link as LinkIcon,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { datasources, type DataSource } from '@/lib/api';

const driverOptions = [
  { value: 'postgresql', label: 'PostgreSQL', className: 'org.postgresql.Driver' },
  { value: 'mysql', label: 'MySQL', className: 'com.mysql.cj.jdbc.Driver' },
  { value: 'oracle', label: 'Oracle', className: 'oracle.jdbc.OracleDriver' },
  { value: 'sqlserver', label: 'SQL Server', className: 'com.microsoft.sqlserver.jdbc.SQLServerDriver' },
];

interface DataSourceUI {
  id: string;
  name: string;
  jdbcUrl: string;
  username: string;
  driver: string;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
}

function toUI(ds: DataSource): DataSourceUI {
  return {
    id: ds.id,
    name: ds.name,
    jdbcUrl: ds.jdbc_url,
    username: ds.user,
    driver: ds.driver,
    status: 'unknown',
  };
}

export default function DataSourcePage() {
  const [dataSources, setDataSources] = useState<DataSourceUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDataSource, setNewDataSource] = useState({
    name: '',
    jdbcUrl: '',
    username: '',
    password: '',
    driver: 'postgresql',
  });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const list = await datasources.list();
      setDataSources(list.map(toUI));
    } catch {
      setDataSources([]);
    }
    setLoading(false);
  };

  const filteredDataSources = dataSources.filter((ds) =>
    ds.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDataSource = async () => {
    const driver = driverOptions.find((d) => d.value === newDataSource.driver);
    try {
      const created = await datasources.create({
        name: newDataSource.name,
        jdbc_url: newDataSource.jdbcUrl,
        user: newDataSource.username,
        password: newDataSource.password,
        driver: driver?.className || '',
      });
      setDataSources([...dataSources, toUI(created)]);
      setIsAddDialogOpen(false);
      setNewDataSource({ name: '', jdbcUrl: '', username: '', password: '', driver: 'postgresql' });
    } catch (err: any) {
      alert(`添加失败: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await datasources.delete(id);
      setDataSources(dataSources.filter((ds) => ds.id !== id));
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await datasources.test(id);
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === id
            ? { ...ds, status: result.connected ? 'connected' : 'error' }
            : ds
        )
      );
    } catch {
      setDataSources((prev) =>
        prev.map((ds) => (ds.id === id ? { ...ds, status: 'error' } : ds))
      );
    }
    setTestingId(null);
  };

  const handleBootstrap = async (id: string) => {
    try {
      await datasources.bootstrap(id, { base_iri: 'http://example.com/ontop/' });
      alert('Bootstrap 成功！本体文件和映射规则已自动生成。');
    } catch (err: any) {
      alert(`Bootstrap 失败: ${err.message}`);
    }
  };

  const handleViewDetail = (id: string) => {
    setDetailId(id);
  };

  const closeDetail = () => {
    setDetailId(null);
  };

  return (
    <>
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">数据源管理</h1>
            <p className="text-sm text-muted-foreground">管理数据库连接配置</p>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索数据源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadSources}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[oklch(0.70_0.15_280)] to-[oklch(0.65_0.18_200)] hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              添加数据源
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>添加数据源</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">数据源名称</Label>
                <Input
                  id="name"
                  value={newDataSource.name}
                  onChange={(e) => setNewDataSource({ ...newDataSource, name: e.target.value })}
                  placeholder="例如: My PostgreSQL"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver">数据库类型</Label>
                <Select
                  value={newDataSource.driver}
                  onValueChange={(value) => setNewDataSource({ ...newDataSource, driver: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择数据库类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {driverOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jdbcUrl">JDBC URL</Label>
                <Input
                  id="jdbcUrl"
                  value={newDataSource.jdbcUrl}
                  onChange={(e) => setNewDataSource({ ...newDataSource, jdbcUrl: e.target.value })}
                  placeholder="jdbc:postgresql://localhost:5432/mydb"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={newDataSource.username}
                    onChange={(e) => setNewDataSource({ ...newDataSource, username: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newDataSource.password}
                    onChange={(e) => setNewDataSource({ ...newDataSource, password: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddDataSource}>添加</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 数据源列表 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="w-[200px]">名称</TableHead>
                <TableHead>JDBC URL</TableHead>
                <TableHead className="w-[120px]">用户</TableHead>
                <TableHead className="w-[200px]">驱动</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredDataSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Database className="mb-2 h-8 w-8 opacity-50" />
                      <p>暂无数据源</p>
                      <p className="text-sm">点击上方按钮添加数据源</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDataSources.map((ds) => (
                  <TableRow key={ds.id}>
                    <TableCell className="font-medium">{ds.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ds.jdbcUrl}
                    </TableCell>
                    <TableCell>{ds.username}</TableCell>
                    <TableCell className="font-mono text-xs">{ds.driver}</TableCell>
                    <TableCell>
                      <Badge
                        variant={ds.status === 'connected' ? 'default' : ds.status === 'error' ? 'destructive' : 'secondary'}
                        className={
                          ds.status === 'connected'
                            ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            : ds.status === 'unknown'
                            ? 'bg-muted text-muted-foreground'
                            : ''
                        }
                      >
                        {ds.status === 'connected' ? '已连接' : ds.status === 'error' ? '错误' : '未检测'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleTest(ds.id)} disabled={testingId === ds.id}>
                            {testingId === ds.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <LinkIcon className="mr-2 h-4 w-4" />
                            )}
                            测试连接
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewDetail(ds.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBootstrap(ds.id)}>
                            <Zap className="mr-2 h-4 w-4" />
                            Bootstrap
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(ds.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 底部统计 */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {dataSources.length} 个数据源</span>
        <span>已连接: {dataSources.filter((ds) => ds.status === 'connected').length}</span>
      </div>

      {/* 连接信息弹窗 */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              连接详情
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const ds = dataSources.find((d) => d.id === detailId);
            if (!ds) return null;
            return (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-[80px_1fr] gap-y-3 text-sm">
                  <span className="text-muted-foreground">名称</span>
                  <span className="font-medium">{ds.name}</span>
                  <span className="text-muted-foreground">JDBC URL</span>
                  <code className="text-xs break-all">{ds.jdbcUrl}</code>
                  <span className="text-muted-foreground">用户</span>
                  <span>{ds.username}</span>
                  <span className="text-muted-foreground">驱动</span>
                  <code className="text-xs">{ds.driver}</code>
                  <span className="text-muted-foreground">状态</span>
                  <Badge
                    variant={ds.status === 'connected' ? 'default' : ds.status === 'error' ? 'destructive' : 'secondary'}
                    className={
                      ds.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-500 w-fit'
                        : 'w-fit'
                    }
                  >
                    {ds.status === 'connected' ? '已连接' : ds.status === 'error' ? '连接失败' : '未检测'}
                  </Badge>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
