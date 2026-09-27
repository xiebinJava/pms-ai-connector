# PMS AI Connector 安全模型

## 1. 信任边界

PMS 后端是唯一业务真源。连接器只负责协议适配、请求上下文传递和结果格式化，不连接数据库，也不实现项目、需求、专题、故事、任务或迭代计划的业务规则。

```text
AI 客户端
  │  MCP / OpenCLI
  │  Bearer Token + requestId + clientId
  ▼
PMS AI Connector
  │  能力发现、参数校验、有限读重试
  │  写操作不自动重试
  ▼
PMS /api/integration/ai/v1
  │  当前用户、权限、scope、业务规则、版本、幂等、审计
  ▼
PMS 数据库和领域服务
```

连接器不会把管理员 Token 替换成调用者身份。PMS 对每个请求重新执行当前用户身份、对象权限和连接器 scope 的交集校验。

## 2. 认证和身份

- OpenCLI 和 stdio MCP 从当前进程的 `PMS_AUTH_TOKEN` 读取 Token。
- HTTP MCP 优先把请求中的 `Authorization: Bearer ...` 转发给 PMS；只有受信任的内部网关才可以配置 `PMS_AUTH_TOKEN` 作为回退 Token。
- HTTP 入口默认要求 Bearer Token，并要求 HTTPS。只有显式设置
  `PMS_MCP_TRUST_FORWARDED_PROTO=true` 时，才会信任由受控反向代理写入的
  `X-Forwarded-Proto: https`；直接客户端伪造该请求头不能绕过 HTTPS 门禁。
- 浏览器 `Origin` 必须精确匹配 `PMS_MCP_ALLOWED_ORIGINS`；不支持 `*`。
- `PMS_MCP_ALLOW_INSECURE_LOCALHOST=true` 只用于本机开发，生产环境必须保持 `false`。
- 连接器不接受请求体中的用户 ID 来覆盖登录身份。

## 3. 写操作安全

写操作由 PMS 自动执行门面处理，不增加人工确认，但不能绕过以下约束：

- PMS 权限和连接器 scope；
- 对象状态、关联关系和流程节点规则；
- 对象版本和流程版本；
- `idempotencyKey` 幂等键；
- `requestId`、`clientId` 和后端审计记录。

连接器不会对写操作的 409、422 或 5xx 自动重试。调用方要重试时，必须复用同一个幂等键，并由 PMS 返回原操作结果或冲突结果。

## 4. 动态能力和流程模板

调用方先读取能力目录和事项流程上下文，再根据当前已发布流程模板选择操作、节点、组件和字段。连接器不硬编码“开发与迭代控制”或任何固定节点名称。

流程模板变化后，调用方必须重新读取能力目录；旧的 `contract` 或流程版本不再适用时，PMS 应返回冲突或校验错误。连接器只展示结构化错误分类，不依赖中文错误文案。

## 5. 网络和部署

- `PMS_BASE_URL` 是部署配置，不能由用户输入；生产环境应固定为可信 PMS 地址。
- 远程 MCP 应放在 HTTPS 反向代理之后，并只允许必要的客户端 Origin；此部署方式需要将
  `PMS_MCP_TRUST_FORWARDED_PROTO` 设为 `true`，且代理必须覆盖而不是透传客户端的同名请求头。
- Docker 镜像以非 root 用户运行，根文件系统只读，仅使用 `/tmp` 临时文件系统。
- 镜像和日志中不得写入长期 Token、密码、SQL、堆栈或敏感字段原文。
- `/healthz` 只表示连接器进程存活，不代表 PMS 数据库、登录态或业务接口可用。

## 6. 失败处理和回滚

客户端按 HTTP 状态和 PMS 响应体业务码共同判断成功。错误对外统一为稳定分类：认证失败、无权限、资源不存在、冲突、参数校验、限流、上游错误或网络错误。

回滚连接器时只需要停止旧容器或安装上一版 OpenCLI 包；连接器不拥有业务数据，因此不执行数据库回滚。PMS 的 `V58__ai_connector_operation_metadata.sql` 和 `V59__repair_legacy_v50_schema.sql` 属于前向迁移，若降级连接器，新增审计列和已完成的 schema guard 保留即可。

## 7. 已知限制

- 0.1.0 使用已有 PMS Token，不提供 OAuth/OIDC 登录流程。
- HTTP MCP 的可信代理责任由部署方承担；代理必须正确覆盖 `X-Forwarded-Proto`，不能让外部客户端伪造受信任来源。
- 真实写入 E2E 默认关闭，需要显式的隔离 PMS、短期 Token 和场景文件。
