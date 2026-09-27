# ChatGPT 远程 MCP 接入

ChatGPT 等远程 AI 客户端只能访问可从客户端网络到达的 HTTPS MCP 地址。连接器的 HTTP 入口不是浏览器页面，也不提供登录页；部署方需要在前面配置 TLS 反向代理和身份转发。

## 1. 部署连接器

复制 `.env.example`，填入实际 PMS 地址和允许的客户端来源：

```bash
cp .env.example .env
```

生产环境的关键设置：

```dotenv
PMS_BASE_URL=http://host.docker.internal:8080/api
PMS_MCP_ALLOWED_ORIGINS=https://chatgpt.example
PMS_MCP_REQUIRE_AUTHORIZATION=true
PMS_MCP_ALLOW_INSECURE_LOCALHOST=false
PMS_MCP_TRUST_FORWARDED_PROTO=true
PMS_MCP_LEGACY=reject
PMS_MCP_RESOURCE_PATH=/mcp
PMS_MCP_OAUTH_ISSUER=https://id.example.com/
PMS_MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
PMS_MCP_OAUTH_SCOPES=ai:context:read,ai:query:read,ai:command:preview
```

启动：

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up --build -d
curl https://mcp.example.com/healthz
```

`/healthz` 返回 `{"status":"ok"}` 只表示 MCP 进程存活。

配置 OAuth 后，客户端可以读取：

```bash
curl -i https://mcp.example.com/.well-known/oauth-protected-resource
```

未携带 Token 的 MCP 请求会通过 `WWW-Authenticate` 指向同一份元数据。连接器不会替代 PMS
登录和授权；必须确保 OAuth 发行方签发的 Token 能被 PMS 集成门面接受，或由受控网关先完成
Token 交换后再转发。

## 2. 反向代理要求

反向代理必须：

1. 只暴露 HTTPS；
2. 覆盖 `X-Forwarded-Proto` 为代理收到的真实协议，不允许客户端值透传；
3. 将客户端的 `Authorization: Bearer ...` 转发给连接器；
4. 限制请求来源和请求体大小；
5. 不把 Token 写入访问日志；
6. 不把任意用户输入转换成 `PMS_BASE_URL`。

如果代理负责认证并且不会转发用户 Token，可以在连接器环境中设置受保护的 `PMS_AUTH_TOKEN`；这时所有请求会以该固定 PMS 用户执行，只有在这是明确的内部服务账号语义时才允许这样部署。面向个人用户的 ChatGPT 接入应优先转发用户自己的短期 Token。

## 3. 在客户端添加 MCP

在 ChatGPT 的连接器/自定义 MCP 配置界面中添加部署后的 HTTPS MCP 地址，使用当前客户端支持的远程 MCP 传输方式。不同 ChatGPT 版本的配置字段可能不同，以客户端界面要求为准；连接器端固定提供 MCP 工具 `pms_capabilities`、`pms_search`、`pms_get`、`pms_get_context`、`pms_execute_operation` 和 `pms_workflow_action`。

首次使用建议先调用 `pms_capabilities`，确认当前用户能看到的需求、项目、专题、故事、任务、迭代计划以及动态流程模板和组件，再执行写操作。

## 4. 最小验证

先确认 HTTP 层：

```bash
curl -i https://mcp.example.com/healthz
curl -i https://mcp.example.com/mcp
```

后一个请求没有正确 MCP 会话或认证时返回 401/4xx 是正常的；不要把 `/healthz` 的成功理解为 PMS 业务调用成功。实际调用必须携带 Bearer Token，并由 PMS 返回当前用户范围内的能力目录。
