# PMS AI Connector

PMS AI Connector 是 PMS 与 OpenCLI、MCP 客户端之间的连接层。

## 边界

- PMS 后端是业务数据、权限、流程模板和审计的唯一真源。
- 连接器只提供共享协议、PMS API Client、MCP Server 和 OpenCLI Plugin。
- 连接器不访问数据库，不使用管理员身份替代当前用户，也不复制 PMS 业务规则。
- 写操作默认自动执行，但每次操作仍由 PMS 后端执行权限、业务、版本、幂等和审计校验。

## 入口

- 本地终端：OpenCLI Plugin。
- DeepSeek Harness：stdio MCP、远程 MCP 或 OpenCLI Plugin。
- ChatGPT、Claude 等工具：远程 HTTPS MCP Server。

### OpenCLI

OpenCLI 当前按插件目录第一层扫描命令文件，因此插件入口位于
`apps/opencli-plugin/` 顶层。开发仓库中的 workspace 依赖只用于本地测试；发布前必须生成
`dist/opencli-plugin/` 独立安装包，再使用 OpenCLI 安装烟测。

```bash
pnpm run build:opencli
opencli plugin install file:///absolute/path/to/pms-ai-connector/dist/opencli-plugin
opencli pms capabilities -f json
opencli pms search topic --keyword 订单 -f json
opencli pms get topic 7 -f json
```

OpenCLI 通过 `PMS_BASE_URL` 和 `PMS_AUTH_TOKEN` 连接 PMS。`PMS_BASE_URL` 默认包含 PMS 的
Spring context path：`http://localhost:8080/api`。`PMS_AUTH_TOKEN` 只从当前进程环境读取，不写入插件或日志。

### MCP stdio

MCP stdio 入口使用同样的 `PMS_BASE_URL` 和 `PMS_AUTH_TOKEN`。配置客户端时请直接运行入口，避免把 `pnpm` 的启动提示写入 MCP stdout；开发环境可使用：

```bash
PMS_BASE_URL=http://localhost:8080/api PMS_AUTH_TOKEN=短期Token \
  ./apps/mcp-server/node_modules/.bin/tsx apps/mcp-server/src/main.ts
```

HTTP MCP 入口是 `apps/mcp-server/src/http-main.ts`，默认监听 `0.0.0.0:3000`，提供无需 PMS
依赖的 `/healthz`。它默认要求 Bearer Token、HTTPS 或可信反向代理，并拒绝未配置的浏览器
Origin；localhost 明文只允许显式开发配置。它会把请求中的 `x-request-id`、W3C
`traceparent`/`tracestate`/`baggage` 传递给 PMS，方便把 AI 调用与 PMS 审计串起来。

如果远程客户端需要 OAuth/OIDC，配置 `PMS_MCP_OAUTH_ISSUER`、可选的
`PMS_MCP_OAUTH_RESOURCE` 和 `PMS_MCP_OAUTH_SCOPES`。连接器提供 RFC 9728 保护资源元数据和
`WWW-Authenticate: Bearer resource_metadata=...` 挑战，但不在连接器内复制登录、用户映射或
业务授权；Bearer Token 会原样交给 PMS，由 PMS 或受控身份网关完成校验/交换。

### Docker

复制 `.env.example` 为 `.env`，填入 PMS 地址和允许的客户端 Origin。生产环境应让 MCP 客户端
转发短期 Bearer Token；只有受信任的内部网关才应配置 `PMS_AUTH_TOKEN` 作为回退 Token。

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up --build -d
curl http://localhost:3000/healthz
```

`PMS_BASE_URL` 必须指向 PMS 集成门面，例如 `http://host.docker.internal:8080/api`；不要填写
前端地址，也不要省略 `/api`。镜像使用只读根文件系统，Token 只通过环境变量或请求头传递。

## 业务范围

首版协议覆盖需求、项目、项目节点、专题、专题节点、故事、故事节点、任务、子任务、迭代计划、工作流模板和用户。

需求只能关联项目、专题、故事中的一个执行对象；流程节点和组件从 PMS 当前绑定的已发布模板动态读取；迭代计划不绑定流程模板。

## 文档

- [安全模型](docs/security-model.md)
- [OpenCLI 安装和使用](docs/opencli-setup.md)
- [ChatGPT 远程 MCP 接入](docs/chatgpt-mcp-setup.md)
- [DeepSeek Harness / 本地 Agent 接入](docs/deepseek-harness-setup.md)
- [兼容矩阵](docs/compatibility-matrix.md)

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm run build:mcp
pnpm run build:opencli
pnpm run conformance:mcp
```

当前首版验证环境：Node.js 24.10.0、pnpm 10.18.2；`engines.node` 保持 Node.js 22 及以上兼容范围。

### 真实 PMS 闭环测试

真实写入 E2E 默认跳过，必须显式提供隔离 PMS 实例、短期 Token、场景文件，并设置
`PMS_E2E_WRITE=true`：

```bash
PMS_E2E_BASE_URL=http://localhost:8080/api \
PMS_E2E_TOKEN=短期Token \
PMS_E2E_SCENARIO_FILE=/absolute/path/to/scenario.json \
PMS_E2E_WRITE=true \
pnpm test
```

场景文件的 `steps`、`cleanup`、`assertions` 和 `invalidRelations` 只使用能力目录中实际发现的
操作、动态字段和流程上下文；测试不会假设固定的节点名称，也不会直接访问数据库。清理必须
通过 PMS 的业务命令完成，不能用 SQL 绕过领域规则。

### GitHub CI

仓库的 GitHub Actions 会在 `release`/`main` 推送和 Pull Request 上执行类型检查、单元/契约测试、
MCP 构建、OpenCLI 独立包烟测、Docker 构建以及固定版本的官方 MCP Conformance 无状态场景。
Conformance 基线只包含官方测试要求的诊断工具/动态工具目录检查，不会屏蔽正常工具、协议版本或 HTTP 安全回归。
真实 PMS 写入测试仍不会在 CI 中自动执行，避免把生产或共享环境当成测试数据库。
