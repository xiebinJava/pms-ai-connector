# PMS AI Connector 0.1.0 阶段 Review 报告

## Review 结论

- 代码和协议：OpenCLI、MCP 都只通过共享 `PmsClient` 调用 PMS 集成 API；写操作最终进入 PMS 的权限、业务、版本、幂等和审计链路。
- 安全：连接器不接受任意 URL、数据库参数或前端 Cookie；HTTP MCP 默认要求 Bearer、HTTPS/可信代理和 Origin 白名单；Token 不写入日志或镜像。
- 业务：能力目录和流程节点/组件动态发现；需求单一执行对象、项目状态约束、成员自动同步、专题/故事关系和无流程迭代计划由 PMS 后端继续负责。
- 数据库：连接器元数据使用不可变 V58；V59 只做正式链路的幂等 schema guard。异常历史 V50 不能自动推断语义，已提供人工审阅/重建说明。

结论：无 blocker、无 high 风险。一次 medium 级文档不一致已修正为 v59。

## 验证证据

- 后端：`TESTCONTAINERS_RYUK_DISABLED=true DOCKER_HOST=unix:///Users/fs/.colima/fsclaw/docker.sock mvn -q clean test` 通过；clean Flyway 校验 59 个迁移。
- 本地 Docker 后端：重建并重启成功，`/api/health` 返回 `status=UP`、`database=UP`、`migration=59`；本地历史中的 V58 checksum 为 `1989930313`，与最终迁移文件一致。
- 连接器：`pnpm typecheck` 通过；`pnpm test` 为 31 passed、5 skipped；`pnpm run build:mcp` 通过；OpenCLI 独立 bundle 安装烟测通过。
- E2E：真实写入场景默认跳过，只有配置隔离 PMS、短期 Token、动态场景文件并显式设置 `PMS_E2E_WRITE=true` 才执行，避免污染开发数据库。

## 已知边界和回滚

- 连接器回滚只需停止旧 MCP 容器或安装上一版 OpenCLI 包；连接器本身不执行数据库回滚。
- 生产数据库如果曾记录冲突的 V50 连接器脚本，不在启动时自动猜测；应先备份，按 `docs/flyway-migration-recovery.md` 审阅或重建。
- 0.1.0 使用已有 PMS Token，暂不包含 OAuth/OIDC 获取刷新和多租户路由。
