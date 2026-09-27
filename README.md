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

## 业务范围

首版协议覆盖需求、项目、项目节点、专题、专题节点、故事、故事节点、任务、子任务、迭代计划、工作流模板和用户。

需求只能关联项目、专题、故事中的一个执行对象；流程节点和组件从 PMS 当前绑定的已发布模板动态读取；迭代计划不绑定流程模板。

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
```

当前首版验证环境：Node.js 24.10.0、pnpm 10.18.2；`engines.node` 保持 Node.js 22 及以上兼容范围。
