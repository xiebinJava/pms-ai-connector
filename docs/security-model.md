# PMS CLI 安全模型

- PMS 后端是身份、权限、流程、动态字段、版本、幂等和审计的唯一真源。
- 浏览器授权采用 loopback callback + PKCE，CLI 不收集或保存 PMS 密码。
- access token 只在当前 CLI 进程内存中使用；refresh token 只进入操作系统凭据管理器。
- CLI 不访问数据库、不保存 Cookie、不使用管理员身份替代当前用户，也不把 Token 写入 stdout、日志或错误堆栈。
- 所有写操作必须经过能力目录和当前上下文，携带 requestId、clientId 和新的 idempotencyKey；最终校验仍由 PMS 后端执行。
- 失败时 stdout 不输出成功数据，结构化错误输出到 stderr 并返回非零退出码。
- 真实写入 E2E 仅使用隔离项目和短期 Token，清理必须通过 PMS 业务命令完成。
