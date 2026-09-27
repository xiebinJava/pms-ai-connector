# PMS CLI coverage matrix

This matrix is the release checklist. A command is considered supported only
when the PMS capability catalog exposes the action and the corresponding CLI
contract/E2E test is green.

| Resource | query | create | update | delete | workflow-action | test status |
| --- | --- | --- | --- | --- | --- | --- |
| 需求 | planned | planned | planned | planned | dynamic | contract pending |
| 项目 | planned | planned | planned | planned | dynamic | contract pending |
| 项目节点 | context | n/a | planned | n/a | planned | dynamic |
| 专题 | planned | planned | planned | planned | dynamic | contract pending |
| 专题节点 | context | n/a | planned | n/a | planned | dynamic |
| 故事 | planned | planned | planned | planned | dynamic | contract pending |
| 故事节点 | context | n/a | planned | n/a | planned | dynamic |
| 任务 | planned | planned | planned | planned | n/a | contract pending |
| 子任务 | planned | planned | planned | planned | n/a | contract pending |
| 迭代计划 | planned | planned | planned | planned | n/a | contract pending |
| 流程模板 | planned | planned | planned | planned | dynamic | contract pending |
| 用户 | planned | restricted | restricted | restricted | n/a | permission gated |
| 组织架构 | planned | restricted | restricted | restricted | n/a | permission gated |
| 角色权限 | planned | restricted | restricted | restricted | n/a | permission gated |
| 批量导入 | planned | preview | execute | n/a | n/a | contract pending |
| 审计日志 | planned | n/a | n/a | n/a | n/a | contract pending |
| 企业项目看板 | planned | n/a | n/a | n/a | n/a | contract pending |

`planned` is intentionally not a promise of an offline implementation: the
backend capability catalog remains the authority for the actual available
operation and field schema.
