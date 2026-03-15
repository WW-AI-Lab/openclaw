## Context

### 现有密钥管理架构（三层）

OpenClaw 的密钥管理分为三个层次：

1. **Auth Profile 层**（最安全）：大模型供应商（OpenAI、Anthropic 等）的 API Key 存储在 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`，支持 `keyRef: SecretRef`（引用外部密钥源）、round-robin 轮换、cooldown 追踪。Claude/Codex CLI 还可选 macOS Keychain。
2. **Config + SecretRef 层**（中等）：web_search 内置供应商（Brave、Perplexity、Gemini、Grok、Kimi）的密钥存储在 `openclaw.json` 的 `tools.web.search` 配置中，支持 `SecretInput`（明文字符串或 `SecretRef`），由 `runtime-web-tools.ts` 在 gateway 启动时解析。
3. **纯 Config/Env 层**（最弱）：metaso/qwen 的密钥虽然在 schema 中声明了 `SecretInputSchema`，但 `runtime-web-tools.ts` 的 `WEB_SEARCH_PROVIDERS` 数组中未包含它们，因此它们的密钥不经过 gateway 的 runtime secret 解析流程，而是在 `web-search.ts` 中直接通过 `normalizeApiKey(metaso?.apiKey)` 读取——此时配置中的 `SecretRef` 对象**不会被解析**，等同于只支持明文或环境变量。

### 千问实现现状

`runQwenSearch` 已经使用了标准的 OpenAI `/chat/completions` 接口，通过 `enable_search: true` 触发联网搜索。但实现与千问深度绑定（默认 baseUrl 指向 DashScope、模型名固定）。Kimi（Moonshot）和 Perplexity 也使用相同的 `/chat/completions` 接口，但各自有独立实现。

## Goals / Non-Goals

**Goals:**

- G1：将 metaso/qwen 的密钥解析纳入 `runtime-web-tools.ts` 的标准解析流程，使 `SecretRef` 可以正常工作
- G2：将 qwen 供应商泛化为 `openai-search`（通用 OpenAI 兼容搜索），支持自定义 `baseUrl`、`model`、`toolName`（显示名称）
- G3：保持 `qwen` 作为 `openai-search` 的配置别名，确保现有用户零迁移成本
- G4：保留 metaso 独立实现（其 API 非 OpenAI 兼容），仅修复密钥解析

**Non-Goals:**

- NG1：不引入 macOS Keychain 集成（这是 auth-profiles 层面的未来改进，超出本次范围）
- NG2：不迁移密钥到 auth-profiles.json（web_search 工具级密钥的管理粒度与 model provider 不同，混入 auth-profiles 会引入不必要的复杂性）
- NG3：不重构现有内置供应商（Brave/Perplexity/Gemini/Grok/Kimi）的实现
- NG4：不合并所有 OpenAI 兼容供应商（Perplexity/Kimi）到 openai-search——它们有各自的特殊逻辑（如 Perplexity 的 search_api transport、Kimi 的 builtin_function tools），强行合并收益低风险高

## Decisions

### D1：将 metaso/qwen 纳入 runtime-web-tools.ts 密钥解析

**选择**：在 `runtime-web-tools.ts` 的 `WEB_SEARCH_PROVIDERS` 数组中添加 `"metaso"` 和 `"qwen"`（或 `"openai-search"`），并补充对应的 `envVarsForProvider` 映射。

**理由**：这是最小改动路径。现有的 `resolveSecretInputWithEnvFallback` 已经完美支持 `SecretRef` 解析 + 环境变量回退 + 诊断信息输出。只需将 metaso/qwen 注册到已有框架中即可。

**替代方案**：
- 方案 B：在 `web-search.ts` 的 `resolveMetasoApiKey`/`resolveQwenApiKey` 中自行实现 `SecretRef` 解析 → 重复 runtime-web-tools.ts 的逻辑，增加维护负担
- 方案 C：将密钥存入 auth-profiles.json → 粒度不匹配（auth-profiles 面向 model provider 的多 key 轮换，web_search 是单 key 工具），引入不必要的复杂性

### D2：openai-search 通用供应商设计

**选择**：新增 `openai-search` 供应商，配置结构为：

```typescript
type OpenAISearchConfig = {
  apiKey?: SecretInput;
  baseUrl?: string;         // 默认: https://dashscope.aliyuncs.com/compatible-mode/v1
  model?: string;           // 默认: qwen-max-latest
  toolName?: string;        // 显示名称，默认: "openai-search"
  enableSearch?: boolean;   // 默认: true，发送 enable_search 参数
  enableThinking?: boolean; // 默认: false
  searchParam?: string;     // 搜索触发参数名，默认: "enable_search"
};
```

`provider: "qwen"` 在解析时自动映射为 `provider: "openai-search"`，并将 `qwen.*` 配置迁移到 `openaiSearch.*`。

**理由**：
- 千问和 DeepSeek 等都使用 `/chat/completions` + `enable_search: true` 模式
- `searchParam` 支持不同供应商的搜索触发方式差异（如某些供应商可能用 `web_search: true`）
- `toolName` 让用户可以在 agent 工具列表中看到有意义的名称（而不是通用的 "openai-search"）

**替代方案**：
- 方案 B：保留 qwen 并为每个 OpenAI 兼容供应商分别实现 → 重复代码，每加一个供应商就要改 7+ 个文件
- 方案 C：用配置数组支持多个 OpenAI 兼容供应商同时存在 → 过度设计，单 provider 模式足够

### D3：配置兼容迁移策略

**选择**：软迁移，不修改用户配置文件。

- `provider: "qwen"` 在 `resolveSearchProvider` 中映射为 `"openai-search"`
- `tools.web.search.qwen.*` 在运行时被读取并用作 `openaiSearch` 的配置源
- Schema 中保留 `qwen` 字段定义（标记为 deprecated）
- `openai-search` 和 `qwen` 不能同时配置（如果都存在，`openai-search` 优先）

**理由**：避免自动修改用户配置文件带来的风险（并发写入、权限、备份等）。用户可以自行迁移，也可以永远使用 `qwen` 别名。

### D4：自动检测优先级

**选择**：在自动检测链中，`openai-search` 放在 `metaso` 之后、`qwen` 位置不变。

已有顺序：brave → gemini → grok → kimi → **metaso → qwen** → perplexity

新顺序：brave → gemini → grok → kimi → metaso → **openai-search** → perplexity

`qwen` 的环境变量 `DASHSCOPE_API_KEY` 自动映射到 `openai-search` 的自动检测。

## Risks / Trade-offs

- **[配置不一致]** → 用户同时配置了 `qwen` 和 `openai-search`。**缓解**：运行时输出 deprecation 警告，`openai-search` 优先，不报错。
- **[searchParam 兼容性]** → 不同 API 对搜索触发参数的处理可能不一致（有些忽略未知参数，有些报错）。**缓解**：默认值 `enable_search` 适用于 DashScope/DeepSeek 等主流兼容 API；文档说明各 API 的实际参数名。
- **[runtime-web-tools.ts 修改]** → 该文件是上游核心文件，合并上游时可能冲突。**缓解**：改动限于数组扩展和 `envVarsForProvider` 函数增补，冲突概率低且易解决。
- **[类型与 schema 膨胀]** → 新增 `openaiSearch` 配置块。**缓解**：复用现有的 `SecretInputSchema`、zod `.strict()` 模式，保持结构与其他供应商一致。

## Open Questions

1. `searchParam` 是否需要支持更复杂的搜索触发模式？例如 Kimi 使用 `tools: [{ type: "builtin_function", function: { name: "$web_search" } }]` 而非简单的布尔参数。当前设计仅支持在 request body 顶层添加 `{ [searchParam]: true }`，是否足够覆盖已知的兼容 API？
2. `toolName` 是否需要影响工具的 schema description？当前计划仅影响日志/UI 显示名，不改变工具 schema。
