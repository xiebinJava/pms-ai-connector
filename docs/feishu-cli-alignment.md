# 与 Feishu CLI 的对齐说明

PMS CLI 借鉴 Feishu CLI 的使用体验，但不复制其平台 API：

1. 安装后直接得到 PATH 命令 `pms`，不需要每个工作台单独集成源码。
2. `auth login/status/logout` 提供稳定认证入口，登录由浏览器完成，凭据由系统密钥环保存。
3. `capabilities`、`search`、`get`、`context` 和 `operation` 形成“发现—查询—预览—执行”的统一命令层。
4. `--format json`、stdout 成功/stderr 失败和非零退出码适合 Agent 组合调用。
5. 高风险写操作先调用 `operation preview`；执行必须带幂等键，响应保留 operationId、auditId、refreshScopes 和 warnings。
6. 用户级 `SKILL.md` 把自然语言请求转换为 CLI 调用，并要求先读取能力和上下文，禁止猜测流程节点和字段。

CLI-Anything 只负责 harness 的生成方法、命令发现和验收模板；PMS CLI 运行时直接调用 PMS API，业务逻辑不在 CLI 中复制。
