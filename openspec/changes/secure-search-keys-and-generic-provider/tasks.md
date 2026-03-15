## 1. 配置类型与 Schema 更新

- [x] 1.1 在 `src/config/types.tools.ts` 中新增 `openaiSearch` 配置类型（apiKey、baseUrl、model、toolName、enableSearch、enableThinking、searchParam），保留 `qwen` 字段并标记为 deprecated
- [x] 1.2 在 `src/config/zod-schema.agent-runtime.ts` 的 `ToolsWebSearchSchema` 中新增 `openaiSearch` 子对象 schema，`provider` 联合类型新增 `"openai-search"`，保留 `"qwen"` 兼容
- [x] 1.3 在 `src/config/schema.help.ts` 中为 `openaiSearch` 各字段添加帮助文本
- [x] 1.4 在 `src/config/schema.labels.ts` 中为 `openaiSearch` 各字段添加标签

## 2. runtime-web-tools 密钥解析集成

- [x] 2.1 在 `src/secrets/runtime-web-tools.ts` 的 `WEB_SEARCH_PROVIDERS` 数组中添加 `"metaso"` 和 `"openai-search"`
- [x] 2.2 在 `normalizeProvider` 函数中新增 `"metaso"`、`"openai-search"` 识别，以及 `"qwen"` → `"openai-search"` 映射
- [x] 2.3 在 `envVarsForProvider` 函数中添加 `metaso` → `["METASO_API_KEY"]` 和 `openai-search` → `["DASHSCOPE_API_KEY", "OPENAI_SEARCH_API_KEY"]` 映射
- [x] 2.4 在 `resolveProviderKeyValue` 函数中支持 `metaso` 和 `openai-search` 的 apiKey 读取路径（包括 `qwen` 回退）
- [x] 2.5 在 `setResolvedWebSearchApiKey` 函数中支持 `metaso` 和 `openai-search` 的 resolved key 写入

## 3. web-search.ts 供应商重构

- [x] 3.1 在 `SEARCH_PROVIDERS` 数组中添加 `"openai-search"`，保留 `"qwen"` 或替换
- [x] 3.2 新增 `OpenAISearchConfig` 类型和对应的 resolve 函数（resolveOpenAISearchConfig、resolveOpenAISearchApiKey、resolveOpenAISearchBaseUrl、resolveOpenAISearchModel、resolveOpenAISearchToolName、resolveOpenAISearchSearchParam 等）
- [x] 3.3 将 `runQwenSearch` 重构为 `runOpenAISearch`，支持 `searchParam` 和 `toolName` 参数
- [x] 3.4 在 `resolveSearchProvider` 中添加 `"openai-search"` 匹配，`"qwen"` 映射到 `"openai-search"` 并输出 deprecation 日志
- [x] 3.5 在 `createWebSearchTool` 的 execute 分支中添加 `openai-search` 的 API key 解析和调用路径
- [x] 3.6 在 `missingSearchKeyPayload` 中添加 `openai-search` 的缺失密钥提示
- [x] 3.7 更新 `__testing` 导出，新增 openai-search 相关的 resolve 函数

## 4. 配置兼容与迁移

- [x] 4.1 在 `resolveOpenAISearchConfig` 中实现 `qwen.*` → `openaiSearch.*` 的配置回退读取逻辑
- [x] 4.2 当检测到 `qwen` 和 `openaiSearch` 同时存在时，输出 deprecation 警告并优先使用 `openaiSearch`

## 5. 测试

- [x] 5.1 更新 `src/config/config.web-search-provider.test.ts`，添加 `openai-search` 的 provider 解析测试（包括 `qwen` 别名映射）
- [x] 5.2 添加 `openai-search` 配置解析测试（默认值、自定义 baseUrl/model/toolName/searchParam）
- [x] 5.3 添加 metaso 和 openai-search 的 runtime-web-tools SecretRef 解析测试
- [x] 5.4 添加 qwen → openai-search 配置兼容回退测试
- [x] 5.5 运行 `pnpm test` 确保相关测试通过（web-search/runtime-web-tools/config 共 101 tests passed，1 unrelated redirect test failure 为既存问题）
