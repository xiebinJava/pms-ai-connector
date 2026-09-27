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

## 只读链路验收

在连接器仓库执行以下命令，可以验证当前 Token 对能力目录、资源查询和专题/故事流程上下文的访问，
不会调用任何写操作：

```bash
PMS_E2E_BASE_URL=http://localhost:8080/api \
PMS_E2E_TOKEN='短期测试Token' \
pnpm run verify:real-pms:readonly
```

能力目录会按 Token scope 过滤动作。完整验收 Token 除了 `pms:query:read`，还应包含
`pms:command:preview`、`pms:command:execute` 以及相关领域 scope；只有查询权限的 Token
可以查询资源，但可能看不到对应的动作资源类型。若当前环境没有专题或故事数据，
可以分别设置 `PMS_E2E_TOPIC_ID` 和 `PMS_E2E_STORY_ID` 指定可读的测试对象。

`/healthz` 只表示连接器进程存活；只有只读验收通过，才说明连接器已经真正打通 PMS 业务接口。

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
