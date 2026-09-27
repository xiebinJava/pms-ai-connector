# PMS CLI E2E 验收

真实验收默认关闭，避免误写业务数据。只读验收需要一个短期用户 Token：

```powershell
$env:PMS_E2E_READONLY="true"
$env:PMS_E2E_BASE_URL="http://localhost:5173/api"
$env:PMS_E2E_TOKEN="<short-lived-user-token>"
$env:PMS_E2E_PROJECT_ID="1" # 可选；不设置时使用列表第一条项目
pnpm vitest run tests/e2e/pms-cli.e2e.test.ts
```

验收覆盖能力目录、项目查询、企业项目看板摘要和项目流程上下文；字段、节点、允许动作均从接口回读，不在测试中硬编码流程节点。

写入验收必须使用隔离账号、隔离项目和业务命令清理。不得直接执行 SQL，不得使用管理员 token，也不得在未设置 cleanup 的情况下打开 `PMS_E2E_WRITE=true`。重复幂等键、无权限用户和过期 Token 的结果应保持由 PMS 后端返回，CLI 不做绕过或本地伪造。
