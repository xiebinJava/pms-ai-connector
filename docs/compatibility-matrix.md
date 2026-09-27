# PMS CLI 兼容矩阵

| 项目 | 版本/范围 | 状态 |
| --- | --- | --- |
| Node.js | 22+ | 支持 |
| Windows | PowerShell 安装脚本、PATH CLI | 支持 |
| macOS/Linux | shell 安装脚本、PATH CLI | 支持 |
| Codex | 用户级 Skill + `Bash(pms:*)` | 支持 |
| Claude Code | 用户级 Skill + PATH CLI | 支持 |
| WorkBuddy | 用户级 Skill + PATH CLI | 支持 |
| ChatGPT 网页版 | 直接调用本地 PATH CLI | 不支持；网页沙箱无法访问用户电脑进程 |
| PMS | `/api/integration/ai/v1`，`clientId=pms-cli` | 必须 |

能力、流程节点、组件、字段和允许动作都以 PMS 当前用户返回的能力目录/上下文为准。连接器不承诺固定节点名称或字段名称。
