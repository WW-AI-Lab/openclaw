## ADDED Requirements

### Requirement: metaso 和 openai-search 纳入 runtime 密钥解析

系统 SHALL 将 `metaso` 和 `openai-search`（含 `qwen` 别名）纳入 `runtime-web-tools.ts` 的标准密钥解析流程，使 `SecretRef`（env/file/exec）能够正确解析。

#### Scenario: metaso SecretRef 解析

- **WHEN** 用户在 `tools.web.search.metaso.apiKey` 配置了 `SecretRef`（如 `{ source: "env", provider: "default", id: "MY_METASO_KEY" }`）
- **THEN** gateway 启动时 SHALL 通过 `resolveSecretInputWithEnvFallback` 解析该 SecretRef 并将解析后的值注入 resolvedConfig

#### Scenario: openai-search SecretRef 解析

- **WHEN** 用户在 `tools.web.search.openaiSearch.apiKey` 配置了 `SecretRef`
- **THEN** gateway 启动时 SHALL 正确解析该 SecretRef

#### Scenario: SecretRef 解析失败回退

- **WHEN** `metaso.apiKey` 的 `SecretRef` 解析失败，但 `METASO_API_KEY` 环境变量已设置
- **THEN** 系统 SHALL 使用环境变量值，并输出 `WEB_SEARCH_KEY_UNRESOLVED_FALLBACK_USED` 诊断信息

#### Scenario: SecretRef 解析失败无回退

- **WHEN** `metaso.apiKey` 的 `SecretRef` 解析失败，且无环境变量可用
- **THEN** 系统 SHALL 输出 `WEB_SEARCH_KEY_UNRESOLVED_NO_FALLBACK` 诊断信息，并在 provider 被显式指定时抛出错误

### Requirement: runtime-web-tools 供应商数组扩展

`WEB_SEARCH_PROVIDERS` 数组 SHALL 包含 `"metaso"` 和 `"openai-search"`，使得自动检测和密钥解析覆盖所有已注册供应商。

#### Scenario: 完整供应商列表

- **WHEN** 系统执行密钥自动检测
- **THEN** `WEB_SEARCH_PROVIDERS` SHALL 包含 `["brave", "gemini", "grok", "kimi", "metaso", "openai-search", "perplexity"]`（按字母序）

#### Scenario: envVarsForProvider 覆盖新供应商

- **WHEN** 系统调用 `envVarsForProvider("metaso")`
- **THEN** SHALL 返回 `["METASO_API_KEY"]`

#### Scenario: envVarsForProvider 覆盖 openai-search

- **WHEN** 系统调用 `envVarsForProvider("openai-search")`
- **THEN** SHALL 返回 `["DASHSCOPE_API_KEY", "OPENAI_SEARCH_API_KEY"]`

### Requirement: 密钥解析诊断信息

系统 SHALL 为 metaso 和 openai-search 供应商提供与内置供应商一致的诊断信息输出。

#### Scenario: 自动检测选中诊断

- **WHEN** 未配置 provider，自动检测选中了 `metaso`
- **THEN** 系统 SHALL 输出 `WEB_SEARCH_AUTODETECT_SELECTED` 诊断信息，消息包含 `"metaso"`

#### Scenario: 非活跃 SecretRef 警告

- **WHEN** 配置了 `metaso.apiKey` 的 `SecretRef`，但自动检测选中了其他供应商
- **THEN** 系统 SHALL 对 metaso 的 SecretRef 输出 inactive surface 警告

### Requirement: normalizeProvider 函数扩展

`runtime-web-tools.ts` 的 `normalizeProvider` 函数 SHALL 识别 `"metaso"`、`"openai-search"` 和 `"qwen"`（映射为 `"openai-search"`）。

#### Scenario: 识别 metaso

- **WHEN** 输入 `"metaso"`（任意大小写）
- **THEN** 返回 `"metaso"`

#### Scenario: 识别 openai-search

- **WHEN** 输入 `"openai-search"`（任意大小写）
- **THEN** 返回 `"openai-search"`

#### Scenario: qwen 映射

- **WHEN** 输入 `"qwen"`
- **THEN** 返回 `"openai-search"`
