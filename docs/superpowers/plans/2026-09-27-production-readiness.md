# PMS AI Connector 生产可用性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复动态能力目录兼容性问题，并通过真实 PMS 只读验证、隔离写入验证和 MCP 客户端验收，确认 OpenCLI + MCP 连接器可以稳定、安全地用于自然语言操作 PMS。

**Architecture:** PMS 后端继续作为唯一业务规则和权限中心；连接器只负责协议适配、能力目录读取、参数校验、上下文传递、幂等执行和错误归一化。能力目录在连接器边界做“线协议兼容解析”，输出给 OpenCLI/MCP 的仍是统一、可供模型理解的规范化目录。

**Tech Stack:** Node.js 22、pnpm 10.18.2、TypeScript、Zod 4.2.0、Vitest、esbuild、OpenCLI 1.8.8、MCP Server SDK 2.1.0、Docker Compose。

**Spec:** `docs/opencli-setup.md`、`docs/chatgpt-mcp-setup.md`、`docs/security-model.md`，以及本次真实 PMS/OpenCLI/MCP 验证结论。

## Global Constraints

- PMS 后端是唯一业务主人；连接器不复制项目、专题、故事、需求或流程节点的业务规则。
- 能力目录、流程模板、节点、组件和字段必须动态发现，不在连接器中硬编码业务节点名称或字段集合。
- 所有自动写操作必须携带 `idempotencyKey`；涉及流程上下文时必须携带匹配的上下文版本和契约版本。
- 认证 Token 只从进程环境或受控 OAuth 转发链路读取，不写入插件文件、日志或测试报告。
- 真实写入测试只能使用专用测试数据，并且必须具备清理步骤；默认回归测试不得修改业务数据。
- 使用 Node.js `>=22`、pnpm `10.18.2`，不引入新的运行时依赖。

## Review Focus

- 后端能力字段缺少 `label` 时，OpenCLI 和 MCP 都应成功返回规范化目录，而不是内部错误；测试归入任务 1。
- 字段既可能是对象映射，也可能是数组；规范化时必须保留字段 key、类型、描述、枚举和关联资源信息；测试归入任务 1。
- 能力目录发生格式漂移时，OpenCLI 必须返回可定位的 validation 错误，不能吞成“PMS 命令执行失败”；测试归入任务 2。
- Token 过期、权限不足、上下文版本过期和非法流程动作必须保持现有错误分类，不能因为能力目录修复而绕过后端权限；测试归入任务 2 和任务 4。
- 只读回归、隔离写入回归和 MCP 协议验收必须互相隔离，任何默认测试都不能改变用户数据；测试归入任务 3 和任务 4。

### Task 1: 修复能力目录线协议兼容和规范化

**Files:**
- Modify: `packages/pms-contracts/src/capability.ts`
- Create: `packages/pms-contracts/src/capability-normalizer.ts`
- Modify: `packages/pms-contracts/src/index.ts`
- Modify: `packages/pms-client/src/PmsClient.ts`
- Test: `tests/contract/schema.test.ts`
- Create: `tests/contract/capability-normalizer.test.ts`
- Test fixture: `tests/fixtures/capabilities/backend-missing-label.json`

**Interfaces:**
- Consumes: PMS `/api/integration/ai/v1/capabilities` 的原始 JSON。
- Produces: `parseCapabilityCatalog(input: unknown): CapabilityCatalog`，返回字段 `label` 已补齐的规范化目录；保留现有 `CapabilityCatalog` 对下游的稳定类型。

- [x] **Step 1: 写失败测试**

  在 `capability-normalizer.test.ts` 中覆盖：

  1. action `inputSchema` 的对象字段缺少 `label` 时，以字段 map key 作为 label；
  2. workflow component 的字段数组缺少 `label` 时，以字段 `key` 作为 label；
  3. 没有 key 的字段使用稳定的降级文案，不抛出内部错误；
  4. `type`、`required`、`description`、`enumValues`、`referenceType` 等原字段完整保留；
  5. 已有 label 时不得被覆盖。

- [x] **Step 2: 运行失败测试**

  Run: `pnpm vitest run tests/contract/capability-normalizer.test.ts`

  Expected: FAIL，原因是缺少 `parseCapabilityCatalog` 或缺少对无 label 线协议的兼容解析。

- [x] **Step 3: 实现规范化边界**

  让线协议 schema 将 `label` 视为可选；在 `capability-normalizer.ts` 中统一处理 action 输入字段和 workflow 字段。`PmsHttpClient.capabilities()` 只通过 `parseCapabilityCatalog` 输出规范化结果，禁止让下游适配器分别实现 fallback。

- [x] **Step 4: 运行测试**

  Run: `pnpm vitest run tests/contract/schema.test.ts tests/contract/capability-normalizer.test.ts tests/contract/pms-client.test.ts`

  Expected: PASS；`backend-missing-label.json` 能被解析，且最终输出中的每个字段都有稳定 label。

- [x] **Step 5: 提交**

  ```bash
  git add packages/pms-contracts/src/capability.ts packages/pms-contracts/src/capability-normalizer.ts packages/pms-contracts/src/index.ts packages/pms-client/src/PmsClient.ts tests/contract tests/fixtures/capabilities/backend-missing-label.json
  git commit -m "fix: normalize capability fields without labels"
  ```

### Task 2: 保留 OpenCLI 的详细错误和适配器一致性

**Files:**
- Modify: `packages/pms-client/src/Errors.ts`
- Modify: `packages/pms-client/src/PmsClient.ts`
- Modify: `apps/opencli-plugin/runtime.ts`
- Test: `tests/contract/pms-client.test.ts`
- Test: `tests/opencli/commands.test.ts`
- Test: `tests/mcp/tools.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `parseCapabilityCatalog` 和 Zod 解析错误。
- Produces: OpenCLI 与 MCP 对同一类能力目录错误返回同一错误 kind，并保留字段路径、请求 ID 和 PMS 状态信息。

- [x] **Step 1: 写失败测试**

  增加后端返回格式漂移、Token 失效、无权限和非法上下文动作的断言；OpenCLI 输出必须是 `kind: validation|unauthorized|forbidden|conflict`，不能是泛化的 `internal`。

- [x] **Step 2: 运行失败测试**

  Run: `pnpm vitest run tests/contract/pms-client.test.ts tests/opencli/commands.test.ts tests/mcp/tools.test.ts`

  Expected: 至少有一项失败，锁定当前未知异常被 `runPmsCommand` 转成 generic internal 的行为。

- [x] **Step 3: 实现错误归一化**

  在 PMS client 边界把能力目录解析失败转成带路径摘要的 `PmsClientError("validation", ...)`；保留现有 PMS HTTP 错误分类；OpenCLI 只负责序列化，不再猜测业务错误。

- [x] **Step 4: 运行测试和适配器对比**

  Run: `pnpm test && pnpm typecheck`

  Expected: 全部现有测试通过，MCP 和 OpenCLI 对同一输入返回一致的业务错误分类。

- [x] **Step 5: 提交**

  ```bash
  git add packages/pms-client/src/Errors.ts packages/pms-client/src/PmsClient.ts apps/opencli-plugin/runtime.ts tests/contract tests/opencli tests/mcp
  git commit -m "fix: preserve connector validation errors"
  ```

### Task 3: 增加真实 PMS 只读验收和能力目录回归

**Files:**
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/closed-loop.spec.ts`
- Create: `tests/e2e/readonly-pms.spec.ts`
- Modify: `package.json`
- Modify: `docs/compatibility-matrix.md`
- Modify: `docs/opencli-setup.md`

**Interfaces:**
- Consumes: Task 1/2 的统一目录和错误模型。
- Produces: `pnpm run verify:real-pms:readonly`，只读验证同一 PMS 用户下 OpenCLI/MCP 的能力目录、搜索和流程上下文结果一致。

- [x] **Step 1: 写只读验收测试**

  覆盖项目、专题、故事、需求、迭代计划的能力目录可见性；覆盖专题/故事流程上下文；至少比较 OpenCLI 与 MCP 的资源类型、数量、当前节点和 allowedActions。

- [x] **Step 2: 运行只读验收**

  Run: `PMS_E2E_BASE_URL=http://localhost:8080/api PMS_E2E_TOKEN=<短期测试Token> pnpm run verify:real-pms:readonly`

  Expected: 返回 PASS；不调用 operations/execute，不修改 PMS 数据。

- [x] **Step 3: 接入脚本和文档**

  为只读验证提供明确脚本入口；文档说明 `/healthz` 只代表进程存活，真正可用性必须通过能力目录、查询和上下文验证。

- [x] **Step 4: 提交**

  ```bash
  git add tests/e2e package.json docs/compatibility-matrix.md docs/opencli-setup.md
  git commit -m "test: add real PMS readonly verification"
  ```

### Task 4: 在隔离数据上验证真实写操作闭环

**Files:**
- Modify: `tests/e2e/closed-loop.spec.ts`
- Modify: `tests/e2e/concurrency-idempotency.spec.ts`
- Modify: `tests/e2e/invalid-relations.spec.ts`
- Modify: `tests/e2e/adapter-consistency.spec.ts`
- Create: `tests/fixtures/e2e/pms-ai-connector-sandbox.json`
- Modify: `docs/security-model.md`

**Interfaces:**
- Consumes: Task 3 的只读能力目录和流程上下文。
- Produces: 可显式开启的 `PMS_E2E_WRITE=true` 测试，验证 OpenCLI/MCP 双适配器的创建、更新、流程动作、幂等重试、并发冲突和清理。

- [x] **Step 1: 定义隔离场景**

  场景只使用专用测试项目/专题/故事/需求，所有名称带唯一 `runId`；cleanup 必须在 `finally` 中执行；默认不开启写测试。

- [x] **Step 2: 写失败/边界测试**

  验证：缺少幂等键被本地拒绝；重复幂等键不产生重复对象；过期上下文被 PMS 拒绝；非法关联关系被拒绝；OpenCLI 与 MCP 结果一致。

- [x] **Step 3: 在测试环境执行**

  Run: `PMS_E2E_WRITE=true PMS_E2E_BASE_URL=<测试环境>/api PMS_E2E_TOKEN=<短期测试Token> PMS_E2E_SCENARIO_FILE=tests/fixtures/e2e/pms-ai-connector-sandbox.json pnpm test`

  Expected: 写入、重复执行、并发和 cleanup 全部 PASS；禁止使用生产库或用户真实对象。

- [x] **Step 4: 提交**

  ```bash
  git add tests/e2e tests/fixtures/e2e/pms-ai-connector-sandbox.json docs/security-model.md
  git commit -m "test: verify isolated PMS write workflows"
  ```

### Task 5: MCP 客户端验收和发布门禁

**Files:**
- Modify: `scripts/run-mcp-conformance.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/chatgpt-mcp-setup.md`
- Modify: `docs/compatibility-matrix.md`
- Modify: `README.md`（如仓库已有 README，则沿用现有版本说明位置）

**Interfaces:**
- Consumes: Task 1-4 的稳定能力目录、错误和写入闭环。
- Produces: CI 可重复验证的 OpenCLI smoke、MCP conformance、只读真实 PMS 验收和发布前检查清单。

- [x] **Step 1: 添加发布前门禁**

  CI 至少执行 `pnpm typecheck`、`pnpm test`、`pnpm run build:opencli`、`pnpm run build:mcp`、OpenCLI smoke 和 MCP conformance；真实 PMS 写入测试只在受保护环境手动/受控触发。

- [x] **Step 2: 做 MCP 真实协议验收**

  验证 OAuth Protected Resource Metadata、401 challenge、最新 MCP protocol header、`tools/list`、`pms_capabilities`、`pms_search`、`pms_get_context` 和一个隔离写操作。

- [x] **Step 3: 更新使用文档**

  明确区分：本地 OpenCLI、远程 HTTPS MCP、只读验证、写操作验证；补充“能力目录必须先成功”的诊断步骤。

- [x] **Step 4: 提交并生成发布候选**

  ```bash
  git add scripts .github docs README.md
  git commit -m "chore: add connector release gates"
  ```

## Recommended Order

1. 先做 Task 1，解除当前 `pms_capabilities` 阻断；
2. 立即做 Task 2，避免后端以后再次发生格式漂移时只看到 generic internal；
3. 做 Task 3，先证明完整读链路和动态流程发现闭环；
4. 仅在专用测试数据上做 Task 4，证明 AI 写操作的幂等、权限和清理闭环；
5. 最后做 Task 5，再接入 ChatGPT、Gibbs Harness 或其他远程 MCP 客户端。

## Completion Criteria

- `opencli pms capabilities -f json` 成功返回当前用户可见的完整能力目录；
- `pms_capabilities`、`pms_search`、`pms_get_context` 在 MCP 中成功；
- OpenCLI 和 MCP 对同一资源的查询、上下文和错误分类一致；
- 隔离环境中创建、更新、流程动作和幂等重试通过，默认测试不改数据；
- Docker/HTTPS/OAuth/MCP conformance 验收通过；
- 文档明确告诉用户如何安装、配置 Token、验证只读链路和安全开启写操作。
