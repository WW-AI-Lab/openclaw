import { Type } from "@sinclair/typebox";
import {
  buildSearchCacheKey,
  DEFAULT_SEARCH_COUNT,
  MAX_SEARCH_COUNT,
  readCachedSearchPayload,
  readConfiguredSecretString,
  readNumberParam,
  readProviderEnvValue,
  readStringParam,
  resolveProviderWebSearchPluginConfig,
  resolveSearchCacheTtlMs,
  resolveSearchCount,
  resolveSearchTimeoutSeconds,
  setProviderWebSearchPluginConfigValue,
  type SearchConfigRecord,
  type WebSearchProviderPlugin,
  type WebSearchProviderToolDefinition,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
} from "openclaw/plugin-sdk/provider-web-search";

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";
const DEFAULT_TOOL_NAME = "openai-search";
const DEFAULT_SEARCH_PARAM = "enable_search";

type OpenAISearchConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  toolName?: string;
  enableSearch?: boolean;
  enableThinking?: boolean;
  searchParam?: string;
};

type ChatCompletionMessage = {
  role?: string;
  content?: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatCompletionMessage;
    finish_reason?: string;
  }>;
};

function resolveOpenAISearchConfig(searchConfig?: SearchConfigRecord): OpenAISearchConfig {
  const openaiSearch = searchConfig?.openaiSearch;
  if (openaiSearch && typeof openaiSearch === "object" && !Array.isArray(openaiSearch)) {
    return openaiSearch as OpenAISearchConfig;
  }
  // Fall back to deprecated qwen config
  const qwen = searchConfig?.qwen;
  if (qwen && typeof qwen === "object" && !Array.isArray(qwen)) {
    return qwen as OpenAISearchConfig;
  }
  return {};
}

function resolveOpenAISearchApiKey(config: OpenAISearchConfig): string | undefined {
  return (
    readConfiguredSecretString(config.apiKey, "tools.web.search.openaiSearch.apiKey") ??
    readProviderEnvValue(["DASHSCOPE_API_KEY", "OPENAI_SEARCH_API_KEY"])
  );
}

function resolveOpenAISearchBaseUrl(config: OpenAISearchConfig): string {
  const baseUrl = typeof config.baseUrl === "string" ? config.baseUrl.trim() : "";
  return baseUrl || DEFAULT_BASE_URL;
}

function resolveOpenAISearchModel(config: OpenAISearchConfig): string {
  const model = typeof config.model === "string" ? config.model.trim() : "";
  return model || DEFAULT_MODEL;
}

function resolveOpenAISearchToolName(config: OpenAISearchConfig): string {
  const toolName = typeof config.toolName === "string" ? config.toolName.trim() : "";
  return toolName || DEFAULT_TOOL_NAME;
}

function resolveOpenAISearchEnableSearch(config: OpenAISearchConfig): boolean {
  return config.enableSearch !== false;
}

function resolveOpenAISearchEnableThinking(config: OpenAISearchConfig): boolean {
  return config.enableThinking === true;
}

function resolveOpenAISearchSearchParam(config: OpenAISearchConfig): string {
  const searchParam = typeof config.searchParam === "string" ? config.searchParam.trim() : "";
  return searchParam || DEFAULT_SEARCH_PARAM;
}

async function runOpenAICompatibleSearch(params: {
  query: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  toolName: string;
  timeoutSeconds: number;
  enableSearch: boolean;
  enableThinking: boolean;
  searchParam: string;
}): Promise<{ content: string; citations: string[] }> {
  const endpoint = `${params.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: "user", content: params.query }],
  };
  if (params.enableSearch) {
    body[params.searchParam] = true;
  }
  if (params.enableThinking) {
    body.enable_thinking = true;
  }

  return withTrustedWebSearchEndpoint(
    {
      url: endpoint,
      timeoutSeconds: params.timeoutSeconds,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    },
    async (res) => {
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(
          `${params.toolName} API error (${res.status}): ${detail || res.statusText}`,
        );
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const message = data.choices?.[0]?.message;
      const content = message?.content?.trim() ?? "No response";

      // Extract URLs from content as citations
      const urlPattern = /https?:\/\/[^\s)<>\]"']+/g;
      const citations = [...new Set(content.match(urlPattern) ?? [])];

      return { content, citations };
    },
  );
}

function createOpenAISearchSchema() {
  return Type.Object({
    query: Type.String({ description: "Search query string." }),
    count: Type.Optional(
      Type.Number({
        description: "Number of results to return (1-10).",
        minimum: 1,
        maximum: MAX_SEARCH_COUNT,
      }),
    ),
  });
}

function createOpenAISearchToolDefinition(
  searchConfig?: SearchConfigRecord,
): WebSearchProviderToolDefinition {
  const osConfig = resolveOpenAISearchConfig(searchConfig);
  const toolName = resolveOpenAISearchToolName(osConfig);

  return {
    description: `Search the web using ${toolName}. Uses an OpenAI-compatible API (DashScope/Qwen) with built-in search capability. Returns AI-synthesized answers with inline citations.`,
    parameters: createOpenAISearchSchema(),
    execute: async (args) => {
      const params = args as Record<string, unknown>;
      const apiKey = resolveOpenAISearchApiKey(osConfig);
      if (!apiKey) {
        return {
          error: "missing_openai_search_api_key",
          message:
            "web_search (openai-search) needs a DashScope or OpenAI-compatible API key. Set DASHSCOPE_API_KEY or OPENAI_SEARCH_API_KEY in the Gateway environment.",
          docs: "https://docs.openclaw.ai/tools/web",
        };
      }

      const query = readStringParam(params, "query", { required: true });
      const count =
        readNumberParam(params, "count", { integer: true }) ??
        searchConfig?.maxResults ??
        undefined;
      const model = resolveOpenAISearchModel(osConfig);
      const baseUrl = resolveOpenAISearchBaseUrl(osConfig);
      const enableSearch = resolveOpenAISearchEnableSearch(osConfig);
      const enableThinking = resolveOpenAISearchEnableThinking(osConfig);
      const searchParam = resolveOpenAISearchSearchParam(osConfig);
      const cacheKey = buildSearchCacheKey([
        "openai-search",
        query,
        resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
        baseUrl,
        model,
        enableSearch,
        enableThinking,
        searchParam,
      ]);
      const cached = readCachedSearchPayload(cacheKey);
      if (cached) {
        return cached;
      }

      const start = Date.now();
      const result = await runOpenAICompatibleSearch({
        query,
        apiKey,
        baseUrl,
        model,
        toolName,
        timeoutSeconds: resolveSearchTimeoutSeconds(searchConfig),
        enableSearch,
        enableThinking,
        searchParam,
      });
      const payload = {
        query,
        provider: "openai-search",
        model,
        toolName,
        tookMs: Date.now() - start,
        externalContent: {
          untrusted: true,
          source: "web_search",
          provider: "openai-search",
          wrapped: true,
        },
        content: wrapWebContent(result.content),
        citations: result.citations,
      };
      writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
      return payload;
    },
  };
}

function getOpenAISearchCredentialValue(searchConfig?: Record<string, unknown>): unknown {
  const openaiSearch = searchConfig?.openaiSearch;
  if (openaiSearch && typeof openaiSearch === "object" && !Array.isArray(openaiSearch)) {
    const val = (openaiSearch as Record<string, unknown>).apiKey;
    if (val !== undefined) {
      return val;
    }
  }
  // Fall back to deprecated qwen config
  const qwen = searchConfig?.qwen;
  if (qwen && typeof qwen === "object" && !Array.isArray(qwen)) {
    return (qwen as Record<string, unknown>).apiKey;
  }
  return undefined;
}

export function createOpenAISearchWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "openai-search",
    label: "OpenAI-Compatible Search",
    hint: "DashScope/Qwen or any OpenAI-compatible search API",
    envVars: ["DASHSCOPE_API_KEY", "OPENAI_SEARCH_API_KEY"],
    placeholder: "sk-...",
    signupUrl: "https://dashscope.aliyun.com/",
    docsUrl: "https://docs.openclaw.ai/tools/web",
    autoDetectOrder: 55,
    credentialPath: "plugins.entries.openai-search.config.webSearch.apiKey",
    inactiveSecretPaths: ["plugins.entries.openai-search.config.webSearch.apiKey"],
    getCredentialValue: getOpenAISearchCredentialValue,
    setCredentialValue: (searchConfigTarget, value) => {
      const scoped = searchConfigTarget.openaiSearch;
      if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) {
        searchConfigTarget.openaiSearch = { apiKey: value };
      } else {
        (scoped as Record<string, unknown>).apiKey = value;
      }
      // Also write to deprecated qwen for backward compat
      const qwen = searchConfigTarget.qwen;
      if (!qwen || typeof qwen !== "object" || Array.isArray(qwen)) {
        searchConfigTarget.qwen = { apiKey: value };
      } else {
        (qwen as Record<string, unknown>).apiKey = value;
      }
    },
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "openai-search")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "openai-search", "apiKey", value);
    },
    createTool: (ctx) =>
      createOpenAISearchToolDefinition(
        (() => {
          const searchConfig = ctx.searchConfig as SearchConfigRecord | undefined;
          const pluginConfig = resolveProviderWebSearchPluginConfig(ctx.config, "openai-search");
          if (!pluginConfig) {
            return searchConfig;
          }
          return {
            ...(searchConfig ?? {}),
            openaiSearch: {
              ...resolveOpenAISearchConfig(searchConfig),
              ...pluginConfig,
            },
          } as SearchConfigRecord;
        })(),
      ),
  };
}

export const __testing = {
  resolveOpenAISearchConfig,
  resolveOpenAISearchApiKey,
  resolveOpenAISearchBaseUrl,
  resolveOpenAISearchModel,
  resolveOpenAISearchToolName,
  resolveOpenAISearchEnableSearch,
  resolveOpenAISearchEnableThinking,
  resolveOpenAISearchSearchParam,
} as const;
