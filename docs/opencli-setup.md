# OpenCLI 安装和使用

## 前置条件

- Node.js 22 或更高版本；
- OpenCLI 1.8.0 或更高版本；
- 可访问 PMS `/api/integration/ai/v1` 的用户 Token。

## 从源码构建并安装

在连接器仓库执行：

```bash
pnpm install
pnpm run build:opencli
opencli plugin install file:///absolute/path/to/pms-ai-connector/dist/opencli-plugin
```

构建产物位于 `dist/opencli-plugin`，已经把 workspace 内部依赖 bundle 进去，不需要把源码目录、pnpm workspace 或 `workspace:*` 依赖复制到 OpenCLI 的安装目录。

## 配置

```bash
export PMS_BASE_URL=http://localhost:8080/api
export PMS_AUTH_TOKEN='短期用户Token'
```

`PMS_BASE_URL` 必须包含 PMS 的 `/api` context path。Token 只从当前进程环境读取，不写入插件文件。

## 常用命令

```bash
opencli pms capabilities -f json
opencli pms search topic --keyword 订单 -f json
opencli pms get topic 7 -f json
opencli pms execute topic.create \
  --argumentsJson '{"title":"订单中心"}' \
  --idempotencyKey "topic-create-订单中心-001" -f json
opencli pms workflow-action topic 7 development-item.node.complete \
  --idempotencyKey "topic-7-complete-node-001" -f json
```

写操作的 `operation`、参数字段、上下文和契约版本以 `pms capabilities` 与事项上下文返回为准。不要根据历史截图或固定节点名称猜参数。

## 排错

- `unauthorized`：检查 Token 是否过期、是否属于目标 PMS 用户。
- `forbidden`：检查用户权限和能力目录中的 scope；不要通过修改本地参数绕过权限。
- `conflict`：重新读取资源和流程上下文；如果是同一业务动作重试，复用原幂等键。
- `validation`：检查动态字段、`contextId/contextVersion`、`contractId/contractVersion` 是否成对提供。
- `network` 或 `timeout`：检查 PMS 地址和网络；连接器只对查询/能力读取做有限重试。
