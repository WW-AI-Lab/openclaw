## Why

当前 Fork 自定义的 web_search 供应商（metaso、qwen）的 API Key 管理方式与 OpenClaw 内置供应商（如 Brave、Perplexity 等）完全一致——都是通过 `openclaw.json` 配置文件明文存储或环境变量读取，并支持 `SecretRef`（env/file/exec）。从安全模型上看，metaso/qwen 的密钥管理与内置供应商处于同一安全等级，但也共享同样的局限：配置文件中的密钥仅依赖文件系统权限保护，没有操作系统级加密（如 macOS Keychain）。本次变更的目标是将 web_search 供应商密钥纳入 OpenClaw 的 auth profile 体系，并将 qwen 供应商泛化为通用 OpenAI 兼容搜索供应商，使其可以适配任何兼容 OpenAI chat/completions API 并支持联网搜索的服务。

## What Changes

- **密钥安全升级**：将 metaso 和 qwen 的 API Key 存储从纯配置文件迁移到 OpenClaw auth profile 体系（`auth-profiles.json`），与大模型供应商密钥保持一致的安全等级。保留 `SecretRef`（env/file/exec）和环境变量作为兼容回退路径。
- **通用 OpenAI 兼容搜索供应商**：将 qwen 供应商重构为通用的 `openai-search` 供应商，支持自定义 `baseUrl`、`model`、`toolName`（显示名称），使其可以适配 DashScope、DeepSeek、零一万物等任何兼容 OpenAI `/chat/completions` 接口且支持联网搜索的服务。
- **配置兼容迁移**：提供自动迁移路径，将现有 `qwen` 配置无缝转换为新的 `openai-search` 配置，不破坏现有用户配置。
- **metaso 供应商保留**：metaso 使用独有的 API 接口（非 OpenAI 兼容），保持独立供应商实现，仅升级密钥管理。

## Capabilities

### New Capabilities

- `openai-compat-search`: 通用的 OpenAI 兼容联网搜索供应商实现。支持自定义 baseUrl、model、toolName，可对接任何兼容 `/chat/completions` 且支持 `enable_search` 或类似搜索触发参数的 API 服务。
- `search-key-auth-profile`: 将 web_search 供应商的 API Key 纳入 auth profile 管理体系，支持 auth profile 存储、SecretRef（env/file/exec）和环境变量的三级回退解析。

### Modified Capabilities

（无现有 spec 需要修改，openspec/specs/ 目录为空）

## Impact

- **源码文件**：
  - `src/agents/tools/web-search.ts` — 重构 qwen → openai-search，新增 auth profile 密钥解析路径
  - `src/config/types.tools.ts` — 新增 `openaiSearch` 类型定义，保留 `qwen` 为兼容别名
  - `src/config/zod-schema.agent-runtime.ts` — 新增 `openaiSearch` schema，保留 `qwen` 兼容
  - `src/config/schema.help.ts` / `schema.labels.ts` — 新增帮助文本和标签
  - `src/secrets/runtime-web-tools.ts` — 新增 auth profile 密钥解析支持
  - `src/agents/auth-profiles/` — 可能需要扩展 profile 类型以支持工具级密钥
- **配置文件**：`~/.openclaw/openclaw.json` 的 `tools.web.search` 部分
- **用户影响**：现有 `qwen` 配置继续工作（兼容别名），但推荐迁移到 `openai-search`；metaso 配置不变
- **测试**：需更新 `src/config/config.web-search-provider.test.ts`，新增 openai-search 和 auth profile 解析测试
