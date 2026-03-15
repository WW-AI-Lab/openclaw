# 自定义代码清单（qwen/metaso web_search 供应商）

本文档记录了 @ww-ai-lab/openclaw Fork 相对于上游 openclaw/openclaw 的全部自定义代码位置，
用于合并上游后验证和恢复。

## 1. `src/agents/tools/web-search.ts` — 运行时代码（约 380 行新增）

### 1.1 常量与类型

```
SEARCH_PROVIDERS 数组 — 添加 "metaso", "qwen"
DEFAULT_METASO_BASE_URL = "https://metaso.cn"
DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_QWEN_MODEL = "qwen-plus"

type MetasoConfig = { apiKey?, baseUrl?, includeSummary? }
type QwenConfig = { apiKey?, baseUrl?, model?, enableThinking? }

type MetasoSearchResponse = { data?: { items?, summary? }, items?, summary? }
type QwenSearchResponse = { choices?: [{ message?: { content?, reasoning_content? } }] }
```

### 1.2 配置解析函数

```
resolveMetasoConfig(search?) → MetasoConfig
resolveMetasoApiKey(metaso?) → string | undefined     (config 或 METASO_API_KEY 环境变量)
resolveMetasoBaseUrl(metaso?) → string
resolveMetasoIncludeSummary(metaso?) → boolean

resolveQwenConfig(search?) → QwenConfig
resolveQwenApiKey(qwen?) → string | undefined         (config 或 DASHSCOPE_API_KEY 环境变量)
resolveQwenBaseUrl(qwen?) → string
resolveQwenModel(qwen?) → string
resolveQwenEnableThinking(qwen?) → boolean
```

### 1.3 搜索执行函数

```
runMetasoSearch({ query, apiKey, baseUrl, includeSummary, timeoutSeconds, count })
  → POST ${baseUrl}/api/search
  → 返回 { content, citations: Array<{ url, title? }> }

runQwenSearch({ query, apiKey, baseUrl, model, enableThinking, timeoutSeconds })
  → POST ${baseUrl}/chat/completions  (enable_search: true)
  → 返回 { content, citations: string[] }
```

### 1.4 集成点（修改已有函数）

- `missingSearchKeyPayload()` — 添加 metaso/qwen 错误消息分支
- `resolveSearchProvider()` — 添加 `raw === "metaso"` / `raw === "qwen"` 匹配 + 自动检测
- `runWebSearch()` — 添加 metaso/qwen 参数定义 + provider dispatch + cache key
- `createWebSearchTool()` — 添加 description 分支、API key 解析分支、参数传递
- `__testing` 导出 — 添加 7 个 resolve 函数

## 2. `src/config/types.tools.ts` — 类型定义

```typescript
// 在 WebSearchConfig 类型中添加:
provider?: "brave" | "perplexity" | "grok" | "gemini" | "kimi" | "metaso" | "qwen";

metaso?: {
  apiKey?: string;
  baseUrl?: string;       // 默认 "https://metaso.cn"
  includeSummary?: boolean;
};

qwen?: {
  apiKey?: string;
  baseUrl?: string;       // 默认 "https://dashscope.aliyuncs.com/compatible-mode/v1"
  model?: string;         // 默认 "qwen-plus"
  enableThinking?: boolean;
};
```

## 3. `src/config/zod-schema.agent-runtime.ts` — Zod 验证 Schema

```typescript
// ToolsWebSearchSchema 中添加:
// provider 枚举增加:
z.literal("metaso"),
z.literal("qwen"),

// 子对象 schema:
metaso: z.object({
  apiKey: SecretInputSchema.optional().register(sensitive),
  baseUrl: z.string().optional(),
  includeSummary: z.boolean().optional(),
}).strict().optional(),

qwen: z.object({
  apiKey: SecretInputSchema.optional().register(sensitive),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  enableThinking: z.boolean().optional(),
}).strict().optional(),
```

## 4. `src/config/schema.help.ts` — 帮助文本

metaso 和 qwen 配置项的 CLI 帮助说明。

## 5. `src/config/schema.labels.ts` — 标签

metaso 和 qwen 的显示标签。

## 6. `src/config/config.web-search-provider.test.ts` — 测试

metaso 和 qwen 的 provider 解析测试用例。

## 快速验证命令

```bash
# 验证运行时代码完整
grep -c 'runMetasoSearch\|runQwenSearch' src/agents/tools/web-search.ts
# 预期: 2（每个函数定义 1 次）

# 验证所有 resolve 函数
grep -c 'resolveMetaso\|resolveQwen' src/agents/tools/web-search.ts
# 预期: ≥ 15

# 验证 schema
grep -c 'metaso\|qwen' src/config/zod-schema.agent-runtime.ts
# 预期: ≥ 4

# 验证类型
grep -c 'metaso\|qwen' src/config/types.tools.ts
# 预期: ≥ 6

# 综合计数
grep -c 'metaso\|qwen' src/agents/tools/web-search.ts
# 预期: ≥ 70
```


---

## 合并上游源码保护规则（@ww-ai-lab/openclaw Fork）

> 本节规则仅适用于从 `openclaw/openclaw` 上游仓库合并代码到本 Fork 时。
> 放在此文件而非根目录 `AGENTS.md` 中，是因为根目录 `AGENTS.md` 会被上游覆盖。

### 包名与工作区引用

- 本 Fork 的 npm 包名为 `@ww-ai-lab/openclaw`（上游为 `openclaw`）。
- 合并上游后，`packages/clawdbot/package.json` 和 `packages/moltbot/package.json` 中的依赖引用**必须**改回 `"@ww-ai-lab/openclaw": "workspace:*"`（上游会将其重置为 `"openclaw": "workspace:*"`）。
- `extensions/` 下的 `"openclaw"` 导入**不要**改名，运行时通过 jiti alias 解析。

### 自定义 web_search 供应商保护

本 Fork 新增了 `qwen` 和 `metaso` 两个 web_search 供应商，代码分布在以下文件：

| 文件 | 需要保留的内容 |
|------|---------------|
| `src/agents/tools/web-search.ts` | `SEARCH_PROVIDERS` 数组含 `"metaso"` / `"qwen"`；常量 `DEFAULT_METASO_*` / `DEFAULT_QWEN_*`；类型 `MetasoConfig` / `QwenConfig`；函数 `resolveMetasoConfig` / `resolveMetasoApiKey` / `resolveMetasoBaseUrl` / `resolveMetasoIncludeSummary` / `resolveQwenConfig` / `resolveQwenApiKey` / `resolveQwenBaseUrl` / `resolveQwenModel` / `resolveQwenEnableThinking`；函数 `runMetasoSearch` / `runQwenSearch`；`missingSearchKeyPayload` 中的 metaso/qwen 分支；`resolveSearchProvider` 中的 metaso/qwen 匹配和自动检测；`createWebSearchTool` 中的 description 分支、API key 解析分支、参数传递；`__testing` 导出中的 7 个 metaso/qwen resolve 函数 |
| `src/config/types.tools.ts` | `provider` 类型联合含 `"metaso"` / `"qwen"`；`metaso?: { apiKey, baseUrl, includeSummary }` 和 `qwen?: { apiKey, baseUrl, model, enableThinking }` 配置块 |
| `src/config/zod-schema.agent-runtime.ts` | `ToolsWebSearchSchema` 中 `provider` 含 `z.literal("metaso")` / `z.literal("qwen")`；`metaso` 和 `qwen` 子对象 schema |
| `src/config/schema.help.ts` | metaso/qwen 相关帮助文本 |
| `src/config/schema.labels.ts` | metaso/qwen 标签 |
| `src/config/config.web-search-provider.test.ts` | metaso/qwen 测试用例 |

**合并后必检项**：运行 `grep -c 'metaso\|qwen' src/agents/tools/web-search.ts`，结果应 ≥ 70。若为 0，说明上游覆盖了自定义代码，需要从最近的包含 qwen/metaso 的 git 提交中恢复。

### 配置文件保护机制

- 用户配置 `~/.openclaw/openclaw.json` 使用 Zod `.strict()` 验证。若 gateway 运行的代码**缺少** qwen/metaso schema 定义，任何 `config set` 操作都会**静默剥离** qwen/metaso 配置。
- 因此必须**先完成代码合并和构建安装，再进行任何配置操作**。
- **构建验证**：即使源码中 schema 正确，旧 dist 残留 chunk 也可能导致验证走错误路径。构建前必须 `rm -rf dist/`，构建后运行 `openclaw doctor` 确认不再报 "Invalid config" 或 "Unrecognized keys" 错误。
- 合并后验证命令：`openclaw config get tools.web.search`，确认 `provider`、`qwen`、`metaso` 字段完整。
- 配置备份位置：`~/.openclaw/openclaw.json.bak*`，包含 qwen 配置的历史备份为 `openclaw.json-bak.022501` 和 `openclaw.json.bak-20260225-pre-agents`。

### 构建与发布

- **构建前必须 `rm -rf dist/`**：旧 dist 残留的 chunk 可能导致 schema 验证走错误的代码路径。
- `pnpm build` 可能因上游 TypeScript 错误失败。使用 `node scripts/tsdown-build.mjs` 进行 esbuild 构建。
- **构建必须包含 UI**：`pnpm build` **不包含** `ui:build`。手动构建流程必须是 `pnpm build && pnpm ui:build`。发布前检查 `ls dist/control-ui/index.html`。
- `npm publish` 使用 `--ignore-scripts` 跳过 prepack hook；版本含 `-N` 后缀时加 `--tag latest`。
- 本地 npm 已认证（`npm whoami` 验证），无需 1Password。
- 发布前必须本地安装验证：`npm install -g .` → `rm -f package-lock.json` → `openclaw gateway restart` → `openclaw gateway status`（确认 RPC probe ok）→ `openclaw config get tools.web.search`（确认 qwen/metaso 完整）→ `openclaw doctor`（确认无 "Invalid config"）→ `curl http://127.0.0.1:18789/`（确认 UI 200）。
- 完整流程参见 skill：`openclaw-upstream-merge`。

### 版本号规范

- 格式：`YYYY.M.D`（与上游一致），如当日已有相同版本则追加 `-N` 后缀（如 `2026.3.10-1`）。
- 检查 npmjs 已发布版本：`npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)"`。

### 依赖版本验证

- 合并后运行 `pnpm install --no-frozen-lockfile`（lockfile 必然过时）。
- 关键依赖：`@mariozechner/pi-ai` 必须为 `package.json` 中声明的版本（当前 `0.57.1`），低版本缺少 `./oauth` 子路径导出。
- 验证：`node -e "require.resolve('@mariozechner/pi-ai/oauth')"`。
