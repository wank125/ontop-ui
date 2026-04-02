# Ontop 管理平台

基于 [Ontop](https://ontop-vkg.org/) 虚拟知识图谱引擎的统一管理界面，对标 Microsoft Fabric IQ 本体管理能力。纯 Ontop 驱动，无需 Protégé。

## 功能模块

### 1. 数据源管理
- 添加/编辑/删除 JDBC 数据源（PostgreSQL、MySQL、SQL Server、Oracle）
- 测试数据库连接
- 查看数据库 Schema（表、列、外键）
- 一键 Bootstrap：自动从数据库生成本体（OWL）+ 映射规则（.obda）

### 2. SPARQL 查询中心
- SPARQL 查询编辑器（带默认查询模板）
- 实时执行查询，结果以表格展示
- 查看 Ontop 重写后的 SQL
- 查询历史记录，支持一键重跑

### 3. 映射编辑器
- 读取/编辑 .obda 映射文件
- 可视化展示映射规则（Mapping ID、Target RDF 模板、Source SQL）
- 在线编辑映射规则的 SQL 和 RDF 模板
- 映射验证（调用 `ontop validate`）
- 重启端点应用更改

### 4. AI 自然语言查询
- 聊天式界面，支持自然语言提问
- LLM 自动生成 SPARQL 查询
- 显示中间步骤：生成的 SPARQL → 重写的 SQL → 查询结果
- 流式响应（SSE），逐步展示处理过程
- 推荐问题快速入口

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Ant Design + Vite |
| 后端 | Python FastAPI + httpx + OpenAI SDK |
| 引擎 | Ontop 5.5.0 CLI + SPARQL Endpoint |
| LLM | LM Studio (glm-4.7-flash)，OpenAI 兼容 API |
| 数据库 | PostgreSQL 15 (Docker) |

## 项目结构

```
ontop-ui/
├── backend/                 # FastAPI 后端
│   ├── main.py              # 应用入口
│   ├── config.py            # 配置（路径、端口、LLM）
│   ├── routers/             # API 路由
│   │   ├── datasources.py   # 数据源管理
│   │   ├── mappings.py      # 映射编辑
│   │   ├── sparql.py        # SPARQL 查询代理
│   │   └── ai_query.py      # AI 自然语言查询
│   ├── services/            # 业务逻辑
│   │   ├── ontop_cli.py     # Ontop CLI 子进程封装
│   │   ├── ontop_endpoint.py # 端点进程管理
│   │   ├── obda_parser.py   # .obda 文件解析/序列化
│   │   └── llm_service.py   # LLM 调用服务
│   ├── models/              # Pydantic 数据模型
│   └── data/                # 本地 JSON 存储（gitignore）
├── frontend/                # React 前端
│   ├── src/
│   │   ├── App.tsx          # 根组件（Tab 导航）
│   │   ├── api/client.ts    # Axios API 封装
│   │   ├── types/index.ts   # TypeScript 类型
│   │   └── components/      # 功能模块组件
│   └── vite.config.ts       # Vite 配置（代理 /api → FastAPI）
└── README.md
```

## 快速启动

### 前置条件

- Java 11+（Ontop 运行需要）
- Python 3.11+
- Node.js 18+
- Docker（运行 PostgreSQL）
- LM Studio（AI 查询功能，可选）

### 1. 启动 PostgreSQL

```bash
docker run -d --name ontop-postgres \
  -p 5433:5432 \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=retail_db \
  postgres:15
```

### 2. 启动 Ontop SPARQL Endpoint

```bash
ontop endpoint \
  --dev \
  --enable-download-ontology \
  --ontology output/retail_ontology.ttl \
  --mapping output/retail_mapping.obda \
  --properties output/retail.properties \
  --cors-allowed-origins "*" \
  --port 8080
```

### 3. 启动 FastAPI 后端

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 5. 访问

浏览器打开 http://localhost:3000

## API 概览

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/v1/datasources` | GET/POST | 数据源列表/创建 |
| `/api/v1/datasources/{id}/test` | POST | 测试连接 |
| `/api/v1/datasources/{id}/schema` | GET | 获取数据库 Schema |
| `/api/v1/datasources/{id}/bootstrap` | POST | 自动生成本体+映射 |
| `/api/v1/mappings` | GET | 列出 .obda 文件 |
| `/api/v1/mappings/{path}/content` | GET/PUT | 读取/保存映射 |
| `/api/v1/mappings/{path}/validate` | POST | 验证映射 |
| `/api/v1/sparql/query` | POST | 执行 SPARQL 查询 |
| `/api/v1/sparql/reformulate` | POST | 查看重写 SQL |
| `/api/v1/ai/query` | GET (SSE) | AI 自然语言查询 |
| `/api/v1/ai/ontology-summary` | GET | 本体结构摘要 |

## 与 Fabric IQ 对比

| Fabric IQ | 本项目（开源替代） |
|-----------|-------------------|
| 本体编辑器 | Ontop Bootstrap（自动生成） |
| Data Binding | .obda 映射编辑器 |
| Graph 引擎 | Ontop SPARQL Endpoint（虚拟知识图谱） |
| SPARQL 查询 | SPARQL 查询中心 |
| Data Agent | AI 助手（LLM + SPARQL） |

## 许可证

本项目仅供研究学习使用。Ontop 本身为 Apache 2.0 许可。
