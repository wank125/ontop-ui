# 天织 — Ontop 虚拟知识图谱管理平台

基于 [Ontop](https://ontop-vkg.org/) 的语义数据平台，提供本体管理、OBDA 映射编辑、SPARQL 查询和 AI 自然语言查询能力。对标 Microsoft Fabric IQ 本体管理功能，纯 Ontop 驱动，无需 Protégé。

## 功能模块

### 1. 数据源管理 `/datasource`
- 添加/编辑/删除 JDBC 数据源（PostgreSQL、MySQL、SQL Server、Oracle）
- 测试数据库连接
- 一键 Bootstrap：从数据库 Schema 自动生成本体（OWL）+ 映射规则（.obda）

### 2. 数据库概览 `/db-schema`
- 浏览已连接数据库的表、列、外键、主键
- 搜索表名，查看列详情
- 触发 Bootstrap 预览和生成

### 3. SPARQL 查询 `/sparql`
- SPARQL 查询编辑器
- 实时执行查询，结果表格展示
- 查看 Ontop 重写后的 SQL
- 查询历史记录，支持一键重跑

### 4. 映射编辑 `/mapping`
- 读取/编辑 .obda 映射文件
- 可视化展示映射规则（Mapping ID、Target、Source）
- 映射验证（`ontop validate`）
- 重启端点应用更改

### 5. AI 助手 `/ai-assistant`
- 聊天式界面，自然语言提问
- LLM 自动生成 SPARQL → 查看重写 SQL → 查询结果
- 流式响应（SSE），逐步展示处理过程
- 快捷问题入口

### 6. 本体可视化 `/ontology`
- 基于 Vis.js 的本体关系图谱
- Tab 切换：关系图谱 / 本体定义列表
- 缩放、拖拽交互

### 7. AI 设置 `/settings`
- 8 种 LLM Provider 选择（OpenAI / LM Studio / Ollama / DeepSeek / 智谱 / Azure / Anthropic / 自定义）
- 自动拉取模型列表
- 系统提示词编辑（支持模板变量）
- 快捷问题管理

### 8. 系统设置 `/system`
- 用户信息展示
- 后端服务健康检查
- Ontop 端点运行状态
- 运行配置只读展示（CLI 路径、端点地址、LLM 配置）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| 后端 | Python FastAPI + httpx + OpenAI SDK + SQLite |
| 引擎 | Ontop 5.5.0 CLI + SPARQL Endpoint |
| LLM | OpenAI 兼容 API（LM Studio / Ollama / DeepSeek 等） |
| 数据库 | PostgreSQL 16 (Docker) |
| 部署 | Docker Compose，pnpm 构建 |

## 项目结构

```
ontop-ui/
├── backend/                    # FastAPI 后端
│   ├── main.py                 # 应用入口 & 生命周期
│   ├── config.py               # 配置（路径、端口、LLM，支持环境变量）
│   ├── database.py             # SQLite 初始化 & 迁移
│   ├── routers/
│   │   ├── datasources.py      # 数据源 CRUD、测试连接、Schema、Bootstrap
│   │   ├── mappings.py         # 映射文件读写、验证、端点重启
│   │   ├── sparql.py           # SPARQL 查询代理 & SQL 重写
│   │   ├── ai_query.py         # AI 自然语言查询（SSE 流式）
│   │   └── ontology.py         # 本体文件解析
│   ├── services/
│   │   ├── ontop_cli.py        # Ontop CLI 子进程封装
│   │   ├── ontop_endpoint.py   # SPARQL 端点进程管理
│   │   ├── obda_parser.py      # .obda 文件解析/序列化
│   │   ├── ttl_parser.py       # .ttl 本体文件解析
│   │   ├── bootstrap_service.py # 自动 Bootstrap 服务
│   │   └── llm_service.py      # LLM 调用服务
│   ├── models/                 # Pydantic 数据模型
│   ├── repositories/           # 数据访问层
│   └── data/                   # SQLite 数据库 & 加密密钥（gitignore）
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/                # App Router 页面
│   │   │   ├── page.tsx        # 首页（仪表盘）
│   │   │   ├── datasource/     # 数据源管理
│   │   │   ├── db-schema/      # 数据库概览
│   │   │   ├── sparql/         # SPARQL 查询
│   │   │   ├── mapping/        # 映射编辑
│   │   │   ├── ai-assistant/   # AI 助手
│   │   │   ├── ontology/       # 本体可视化
│   │   │   ├── settings/       # AI 设置
│   │   │   └── system/         # 系统设置
│   │   ├── components/         # 共享组件
│   │   │   ├── sidebar-nav.tsx # 侧边栏导航
│   │   │   ├── top-bar.tsx     # 顶栏（端点状态、用户菜单）
│   │   │   └── ui/             # shadcn/ui 组件库
│   │   └── lib/
│   │       ├── api.ts          # 后端 API 封装
│   │       └── utils.ts        # 工具函数
│   └── package.json
├── docker/
│   ├── backend/Dockerfile      # 后端镜像
│   ├── frontend/Dockerfile     # 前端镜像
│   └── postgres/               # 数据库初始化 SQL
├── docker-compose.yml          # 默认环境（retail）
├── docker-compose.lvfa.yml     # LVFA 演示环境
└── docs/
    ├── test-plan.md            # 页面测试计划
    └── screenshots/            # 测试截图
```

## 快速启动

### 前置条件

- Docker & Docker Compose
- Java 11+（Ontop 运行需要）
- LM Studio 或其他 OpenAI 兼容服务（AI 查询功能，可选）

### 一键启动（推荐）

```bash
# 启动所有服务（PostgreSQL + Backend + Frontend）
docker compose -f docker-compose.lvfa.yml up -d --build

# 访问
# 前端: http://localhost:3001
# 后端 API: http://localhost:8001/docs
# PostgreSQL: localhost:5436 (admin/test123)
```

### 手动启动（开发模式）

**1. 启动 PostgreSQL**

```bash
docker compose -f docker-compose.lvfa.yml up -d postgres-lvfa
```

**2. 启动后端**

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**3. 启动前端**

```bash
cd frontend
pnpm install
pnpm dev --port 3001
```

**4. 访问**

浏览器打开 http://localhost:3001

### 环境变量

后端配置通过环境变量覆盖（参见 `backend/config.py`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ONTOP_CLI` | `./docker/ontop-cli/ontop` | Ontop CLI 路径 |
| `ONTOP_OUTPUT` | `./docker/backend/ontop-output` | 映射/本体文件目录 |
| `ONTOP_ENDPOINT_PORT` | `8080` | SPARQL 端点端口 |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | LLM API 地址 |
| `LLM_MODEL` | `zai-org/glm-4.7-flash` | LLM 模型名 |
| `LLM_API_KEY` | `lm-studio` | LLM API Key |
| `FASTAPI_PORT` | `8000` | 后端端口 |

前端通过 `BACKEND_URL` 环境变量指定后端地址（Docker 内默认 `http://backend:8000`）。

## API 概览

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/config` | GET | 系统配置（只读） |
| `/api/v1/datasources` | GET/POST | 数据源列表/创建 |
| `/api/v1/datasources/{id}/test` | POST | 测试连接 |
| `/api/v1/datasources/{id}/schema` | GET | 获取数据库 Schema |
| `/api/v1/datasources/{id}/bootstrap` | POST | 自动生成本体+映射 |
| `/api/v1/mappings` | GET | 列出 .obda 文件 |
| `/api/v1/mappings/{path}/content` | GET/PUT | 读取/保存映射 |
| `/api/v1/mappings/{path}/validate` | POST | 验证映射 |
| `/api/v1/mappings/restart-endpoint` | POST | 重启 SPARQL 端点 |
| `/api/v1/sparql/query` | POST | 执行 SPARQL 查询 |
| `/api/v1/sparql/reformulate` | POST | 查看重写 SQL |
| `/api/v1/sparql/endpoint-status` | GET | 端点运行状态 |
| `/api/v1/ai/query` | GET (SSE) | AI 自然语言查询 |
| `/api/v1/ai/providers` | GET | LLM Provider 列表 |
| `/api/v1/ai/config` | GET/PUT | AI 模型配置 |
| `/api/v1/ai/system-prompt` | GET/PUT | 系统提示词 |
| `/api/v1/ai/quick-questions` | GET/PUT | 快捷问题 |
| `/api/v1/ai/discover-models` | POST | 自动发现可用模型 |
| `/api/v1/ontology/parse` | POST | 解析本体文件 |

## 数据存储

| 数据类型 | 存储方式 | 说明 |
|---------|---------|------|
| 数据源配置 | SQLite | 加密存储数据库密码（Fernet） |
| AI 配置 | SQLite | Provider、模型、API Key |
| 查询历史 | SQLite | SPARQL 查询记录 |
| 本体文件 | 文件系统 | `.ttl` 文件 |
| 映射文件 | 文件系统 | `.obda` 文件 |
| 连接属性 | 文件系统 | `.properties` 文件 |

## 页面一览

| 页面 | 路由 | 功能 |
|------|------|------|
| 仪表盘 | `/` | 统计概览、能力卡片、快速开始 |
| 数据源管理 | `/datasource` | 数据库连接管理 |
| 数据库概览 | `/db-schema` | 表结构浏览 |
| SPARQL 查询 | `/sparql` | 查询编辑与执行 |
| 映射编辑 | `/mapping` | OBDA 映射管理 |
| AI 助手 | `/ai-assistant` | 自然语言转 SPARQL |
| 本体可视化 | `/ontology` | 关系图谱展示 |
| AI 设置 | `/settings` | 模型与提示词配置 |
| 系统设置 | `/system` | 用户信息、服务状态、运行配置 |

## 许可证

本项目仅供研究学习使用。Ontop 本身为 Apache 2.0 许可。
