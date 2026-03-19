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

const DEFAULT_METASO_BASE_URL = "https://metaso.cn/api/open/search";

type MetasoConfig = {
  apiKey?: string;
  baseUrl?: string;
  includeSummary?: boolean;
};

type MetasoSearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
};

type MetasoSearchResponse = {
  data?: {
    items?: MetasoSearchResult[];
    summary?: string;
  };
  code?: number;
  message?: string;
};

function resolveMetasoConfig(searchConfig?: SearchConfigRecord): MetasoConfig {
  const metaso = searchConfig?.metaso;
  return metaso && typeof metaso === "object" && !Array.isArray(metaso)
    ? (metaso as MetasoConfig)
    : {};
}

function resolveMetasoApiKey(metaso?: MetasoConfig): string | undefined {
  return (
    readConfiguredSecretString(metaso?.apiKey, "tools.web.search.metaso.apiKey") ??
    readProviderEnvValue(["METASO_API_KEY"])
  );
}

function resolveMetasoBaseUrl(metaso?: MetasoConfig): string {
  const baseUrl = typeof metaso?.baseUrl === "string" ? metaso.baseUrl.trim() : "";
  return baseUrl || DEFAULT_METASO_BASE_URL;
}

async function runMetasoSearch(params: {
  query: string;
  count: number;
  apiKey: string;
  baseUrl: string;
  timeoutSeconds: number;
  includeSummary?: boolean;
}): Promise<{ results: Array<Record<string, unknown>>; summary?: string }> {
  return withTrustedWebSearchEndpoint(
    {
      url: params.baseUrl,
      timeoutSeconds: params.timeoutSeconds,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          q: params.query,
          count: params.count,
          ...(params.includeSummary ? { include_summary: true } : {}),
        }),
      },
    },
    async (res) => {
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Metaso API error (${res.status}): ${detail || res.statusText}`);
      }

      const data = (await res.json()) as MetasoSearchResponse;
      if (data.code && data.code !== 0 && data.code !== 200) {
        throw new Error(`Metaso API error (code ${data.code}): ${data.message ?? "unknown error"}`);
      }

      const items = Array.isArray(data.data?.items) ? data.data.items : [];
      return {
        results: items.map((entry) => ({
          title: entry.title ? wrapWebContent(entry.title, "web_search") : "",
          url: entry.url ?? "",
          description: entry.snippet
            ? wrapWebContent(entry.snippet, "web_search")
            : entry.content
              ? wrapWebContent(entry.content, "web_search")
              : "",
        })),
        summary: data.data?.summary,
      };
    },
  );
}

function createMetasoSchema() {
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

function createMetasoToolDefinition(
  searchConfig?: SearchConfigRecord,
): WebSearchProviderToolDefinition {
  return {
    description:
      "Search the web using Metaso. Chinese web search with AI summaries. Returns titles, URLs, and snippets.",
    parameters: createMetasoSchema(),
    execute: async (args) => {
      const params = args as Record<string, unknown>;
      const metasoConfig = resolveMetasoConfig(searchConfig);
      const apiKey = resolveMetasoApiKey(metasoConfig);
      if (!apiKey) {
        return {
          error: "missing_metaso_api_key",
          message:
            "web_search (metaso) needs a Metaso API key. Set METASO_API_KEY in the Gateway environment, or configure tools.web.search.metaso.apiKey.",
          docs: "https://docs.openclaw.ai/tools/web",
        };
      }

      const query = readStringParam(params, "query", { required: true });
      const count =
        readNumberParam(params, "count", { integer: true }) ??
        searchConfig?.maxResults ??
        undefined;
      const baseUrl = resolveMetasoBaseUrl(metasoConfig);
      const cacheKey = buildSearchCacheKey([
        "metaso",
        query,
        resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
        baseUrl,
      ]);
      const cached = readCachedSearchPayload(cacheKey);
      if (cached) {
        return cached;
      }

      const start = Date.now();
      const result = await runMetasoSearch({
        query,
        count: resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
        apiKey,
        baseUrl,
        timeoutSeconds: resolveSearchTimeoutSeconds(searchConfig),
        includeSummary: metasoConfig.includeSummary,
      });
      const payload = {
        query,
        provider: "metaso",
        count: result.results.length,
        tookMs: Date.now() - start,
        externalContent: {
          untrusted: true,
          source: "web_search",
          provider: "metaso",
          wrapped: true,
        },
        results: result.results,
        ...(result.summary ? { summary: wrapWebContent(result.summary, "web_search") } : {}),
      };
      writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
      return payload;
    },
  };
}

export function createMetasoWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "metaso",
    label: "Metaso Search",
    hint: "Chinese web search with AI summaries",
    envVars: ["METASO_API_KEY"],
    placeholder: "sk-...",
    signupUrl: "https://metaso.cn/",
    docsUrl: "https://docs.openclaw.ai/tools/web",
    autoDetectOrder: 50,
    credentialPath: "plugins.entries.metaso.config.webSearch.apiKey",
    inactiveSecretPaths: ["plugins.entries.metaso.config.webSearch.apiKey"],
    getCredentialValue: (searchConfig) => {
      const metaso = searchConfig?.metaso;
      return metaso && typeof metaso === "object" && !Array.isArray(metaso)
        ? (metaso as Record<string, unknown>).apiKey
        : undefined;
    },
    setCredentialValue: (searchConfigTarget, value) => {
      const scoped = searchConfigTarget.metaso;
      if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) {
        searchConfigTarget.metaso = { apiKey: value };
        return;
      }
      (scoped as Record<string, unknown>).apiKey = value;
    },
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "metaso")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "metaso", "apiKey", value);
    },
    createTool: (ctx) =>
      createMetasoToolDefinition(
        (() => {
          const searchConfig = ctx.searchConfig as SearchConfigRecord | undefined;
          const pluginConfig = resolveProviderWebSearchPluginConfig(ctx.config, "metaso");
          if (!pluginConfig) {
            return searchConfig;
          }
          return {
            ...(searchConfig ?? {}),
            metaso: {
              ...resolveMetasoConfig(searchConfig),
              ...pluginConfig,
            },
          } as SearchConfigRecord;
        })(),
      ),
  };
}
