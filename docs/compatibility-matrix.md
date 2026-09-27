# 兼容矩阵

## 当前版本

| 项目 | 版本/要求 | 说明 |
| --- | --- | --- |
| Connector | 0.1.0 | 当前 OpenCLI + MCP 独立连接器 |
| PMS AI API | `/api/integration/ai/v1` | 能力、查询、流程上下文、自动执行 |
| PMS 数据库迁移 | v59 | 必须包含不可变的 `V58__ai_connector_operation_metadata.sql` 和 `V59__repair_legacy_v50_schema.sql` |
| Node.js | 22+ | 开发验证使用 Node.js 24.10.0 |
| pnpm | 10.18.2 | 与 `packageManager` 一致 |
| OpenCLI | 1.8.0+ | 使用插件第一层命令发现机制 |
| MCP SDK | `@modelcontextprotocol/node/server` 2.1.0 | stdio 与 Node HTTP 入口 |
| Zod | 4.2.0 | 所有 workspace 共享同一主版本，避免 schema 运行时重复 |
| MCP Conformance | `@modelcontextprotocol/conformance` 0.2.0-alpha.11 | CI 固定运行 2026-07-28 `server-stateless` 场景；5 个不适用于静态生产工具目录的检查有窄范围基线 |
| Docker | 支持 Compose v2 | MCP 镜像使用 Node 22 Alpine、非 root、只读根文件系统 |

## 能力范围

| 领域 | 读取 | 写入 | 约束 |
| --- | --- | --- | --- |
| 需求 | 列表、详情/流程上下文 | 创建、更新、执行对象关联 | 一个需求只能绑定项目、专题、故事中的一个 |
| 项目 | 列表、流程上下文 | 项目命令、节点和任务命令 | 由 PMS 权限、项目状态和流程版本校验 |
| 专题 | 列表、流程上下文 | 创建、更新、项目关联、节点和任务命令 | 项目可选；绑定项目必须满足 PMS 状态规则 |
| 故事 | 列表、流程上下文 | 创建、更新、专题关联、节点和任务命令 | 专题可选；流程节点由故事模板动态提供 |
| 迭代计划 | 列表和关系查询 | 创建、更新、故事加入/移除 | 不绑定流程模板，不创建流程节点 |
| 流程模板 | 类型、版本、节点、组件、字段 | 通过 PMS 配置界面维护 | 连接器只动态发现，不复制模板配置逻辑 |
| 用户 | 能力目录中的可见用户信息 | 由 PMS 领域规则处理成员同步 | 连接器不直接维护项目成员 |

## 传输和验证状态

| 入口 | 状态 | 已验证内容 |
| --- | --- | --- |
| MCP stdio | 可用 | `initialize`、`tools/list`、6 个工具注册 |
| MCP HTTP | 可用 | `/healthz`、Bearer、HTTPS/代理、Origin 门禁、OAuth 资源元数据、Trace Context 转发 |
| OpenCLI | 可用 | pnpm run smoke:opencli 验证独立 bundle、临时 HOME 安装、能力命令和参数错误退出码 |
| 真实 PMS 只读验收 | 已提供 | `pnpm run verify:real-pms:readonly` 验证动态能力、需求/项目/专题/故事/迭代计划查询及专题/故事流程上下文；默认不执行写操作 |
| 真实写入 E2E | 默认跳过 | 需要隔离 PMS、短期 Token、动态场景文件和 `PMS_E2E_WRITE=true` |

## 不兼容或未覆盖

- 不支持把前端登录 Cookie 当作连接器认证凭据。
- 不支持没有 `/api` context path 的 PMS 地址配置。
- 不支持连接器直接访问数据库或通过固定节点名称写入流程字段。
- 0.1.0 未提供 OAuth/OIDC 登录页、Token 获取/刷新和多租户路由；仅提供保护资源元数据和
  Bearer Token 原样转发，实际身份映射由 PMS/受控网关负责。
