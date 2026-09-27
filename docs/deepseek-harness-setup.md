# DeepSeek Harness / 本地 Agent 接入

连接器支持两种本地接入方式：stdio MCP 和 OpenCLI。优先使用 stdio MCP；如果 Harness 原生支持 OpenCLI 命令插件，也可以安装 OpenCLI 包。

## stdio MCP

在启动 Harness 的同一环境中配置：

```bash
export PMS_BASE_URL=http://localhost:8080/api
export PMS_AUTH_TOKEN='短期用户Token'
```

开发环境直接启动：

```bash
./apps/mcp-server/node_modules/.bin/tsx \
  apps/mcp-server/src/main.ts
```

将这条命令作为 Harness 的 MCP stdio server command。MCP stdout 只能承载协议消息，日志会写到 stderr；不要通过会向 stdout 打印启动提示的包装脚本启动。

如果使用已构建的运行产物，先执行 `pnpm run build:mcp`，再让部署脚本用 Node 运行 `dist/mcp-http-main.js` 的 HTTP 入口；stdio 开发入口仍使用 `src/main.ts`，其依赖 workspace 运行时。

## OpenCLI

```bash
pnpm run build:opencli
opencli plugin install file:///absolute/path/to/pms-ai-connector/dist/opencli-plugin
export PMS_BASE_URL=http://localhost:8080/api
export PMS_AUTH_TOKEN='短期用户Token'
opencli pms capabilities -f json
```

## 给 Agent 的使用顺序

1. 调用能力目录，读取当前用户可用资源、操作、scope 和流程模板；
2. 读取目标事项的流程上下文，确认当前节点、流程版本、组件、字段和允许动作；
3. 对动态字段进行参数校验；
4. 写操作生成稳定的幂等键和请求 ID；
5. 写入后用查询接口回读，不假设前端页面或固定节点名称。

连接器不替 Agent 处理业务决策：需求仍只能绑定一个执行对象，项目/专题/故事的流程和成员同步由 PMS 后端判断。
