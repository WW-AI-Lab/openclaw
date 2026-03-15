## ADDED Requirements

### Requirement: openai-search 供应商注册

系统 SHALL 在 `SEARCH_PROVIDERS` 数组中注册 `"openai-search"` 作为一个新的 web_search 供应商。该供应商 SHALL 替代现有的 `"qwen"` 供应商，成为所有兼容 OpenAI `/chat/completions` API 且支持联网搜索的服务的统一入口。

#### Scenario: openai-search 出现在可用供应商列表中

- **WHEN** 系统加载 web_search 工具
- **THEN** `SEARCH_PROVIDERS` 数组 SHALL 包含 `"openai-search"`

#### Scenario: qwen 别名映射

- **WHEN** 用户配置 `tools.web.search.provider` 为 `"qwen"`
- **THEN** `resolveSearchProvider` SHALL 返回 `"openai-search"`，并在日志中输出 deprecation 警告

### Requirement: openai-search 配置结构

系统 SHALL 支持以下配置结构用于 `openai-search` 供应商：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | `SecretInput` | — | API 密钥（支持字符串或 SecretRef） |
| `baseUrl` | `string` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | API 基础 URL |
| `model` | `string` | `qwen-max-latest` | 模型名称 |
| `toolName` | `string` | `"openai-search"` | 工具显示名称 |
| `enableSearch` | `boolean` | `true` | 是否发送搜索触发参数 |
| `enableThinking` | `boolean` | `false` | 是否启用思考模式 |
| `searchParam` | `string` | `"enable_search"` | 搜索触发参数名 |

配置路径为 `tools.web.search.openaiSearch`。

#### Scenario: 最小配置

- **WHEN** 用户仅配置 `tools.web.search.openaiSearch.apiKey`
- **THEN** 系统 SHALL 使用 DashScope 默认 baseUrl 和 qwen-max-latest 模型

#### Scenario: 自定义 DeepSeek 配置

- **WHEN** 用户配置 `openaiSearch.baseUrl` 为 `"https://api.deepseek.com/v1"`、`openaiSearch.model` 为 `"deepseek-chat"`、`openaiSearch.toolName` 为 `"deepseek-search"`
- **THEN** 系统 SHALL 使用 DeepSeek API 进行联网搜索，工具显示名为 `"deepseek-search"`

#### Scenario: 自定义搜索参数名

- **WHEN** 用户配置 `openaiSearch.searchParam` 为 `"web_search"`
- **THEN** 系统 SHALL 在请求体中发送 `{ "web_search": true }` 而非 `{ "enable_search": true }`

### Requirement: qwen 配置兼容读取

系统 SHALL 支持从旧的 `tools.web.search.qwen` 配置路径读取配置，并将其作为 `openai-search` 供应商的配置源。

#### Scenario: 旧配置自动迁移

- **WHEN** 用户配置了 `tools.web.search.qwen.apiKey` 但未配置 `tools.web.search.openaiSearch`
- **THEN** 系统 SHALL 使用 `qwen.*` 配置启动 `openai-search` 供应商

#### Scenario: 新旧配置同时存在

- **WHEN** 用户同时配置了 `tools.web.search.qwen` 和 `tools.web.search.openaiSearch`
- **THEN** 系统 SHALL 优先使用 `openaiSearch` 配置，并输出 deprecation 警告提示用户移除 `qwen` 配置

### Requirement: openai-search API 调用

系统 SHALL 通过标准 OpenAI `/chat/completions` 接口执行联网搜索。

#### Scenario: 标准搜索请求

- **WHEN** agent 触发 web_search 工具且 provider 为 `openai-search`
- **THEN** 系统 SHALL 发送 POST 请求到 `{baseUrl}/chat/completions`，请求体包含 `model`、`messages`（用户查询）和搜索触发参数（如 `enable_search: true`），请求头包含 `Authorization: Bearer {apiKey}`

#### Scenario: 响应解析

- **WHEN** API 返回 chat/completions 格式的响应
- **THEN** 系统 SHALL 从 `choices[0].message.content` 提取搜索结果内容，并通过正则提取 URL 作为 citations

#### Scenario: API 错误处理

- **WHEN** API 返回非 2xx 状态码
- **THEN** 系统 SHALL 调用 `throwWebSearchApiError` 生成标准化错误信息

### Requirement: openai-search 环境变量支持

系统 SHALL 支持通过环境变量配置 `openai-search` 供应商的 API Key。

#### Scenario: DASHSCOPE_API_KEY 环境变量

- **WHEN** 未配置 `openaiSearch.apiKey` 且环境变量 `DASHSCOPE_API_KEY` 已设置
- **THEN** 系统 SHALL 使用 `DASHSCOPE_API_KEY` 的值作为 API Key

#### Scenario: OPENAI_SEARCH_API_KEY 环境变量

- **WHEN** 未配置 `openaiSearch.apiKey` 且环境变量 `OPENAI_SEARCH_API_KEY` 已设置
- **THEN** 系统 SHALL 使用 `OPENAI_SEARCH_API_KEY` 的值作为 API Key

#### Scenario: 自动检测

- **WHEN** 未显式配置 provider，且 `DASHSCOPE_API_KEY` 或 `OPENAI_SEARCH_API_KEY` 环境变量存在
- **THEN** 系统 SHALL 自动选择 `openai-search` 作为搜索供应商
