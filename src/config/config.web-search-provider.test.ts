import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateConfigObject } from "./config.js";
import { buildWebSearchProviderConfig } from "./test-helpers.js";

vi.mock("../runtime.js", () => ({
  defaultRuntime: { log: vi.fn(), error: vi.fn() },
}));

const { __testing } = await import("../agents/tools/web-search.js");
const {
  resolveSearchProvider,
  resolveOpenAISearchConfig,
  resolveOpenAISearchApiKey,
  resolveOpenAISearchBaseUrl,
  resolveOpenAISearchModel,
  resolveOpenAISearchToolName,
  resolveOpenAISearchEnableSearch,
  resolveOpenAISearchEnableThinking,
  resolveOpenAISearchSearchParam,
} = __testing;

describe("web search provider config", () => {
  it("accepts perplexity provider and config", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        enabled: true,
        provider: "perplexity",
        providerConfig: {
          apiKey: "test-key", // pragma: allowlist secret
          baseUrl: "https://openrouter.ai/api/v1",
          model: "perplexity/sonar-pro",
        },
      }),
    );

    expect(res.ok).toBe(true);
  });

  it("accepts gemini provider and config", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        enabled: true,
        provider: "gemini",
        providerConfig: {
          apiKey: "test-key", // pragma: allowlist secret
          model: "gemini-2.5-flash",
        },
      }),
    );

    expect(res.ok).toBe(true);
  });

  it("accepts gemini provider with no extra config", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        provider: "gemini",
      }),
    );

    expect(res.ok).toBe(true);
  });

  it("accepts brave llm-context mode config", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        provider: "brave",
        providerConfig: {
          mode: "llm-context",
        },
      }),
    );

    expect(res.ok).toBe(true);
  });

  it("rejects invalid brave mode config values", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        provider: "brave",
        providerConfig: {
          mode: "invalid-mode",
        },
      }),
    );

    expect(res.ok).toBe(false);
  });

  it("accepts metaso provider and config", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        enabled: true,
        provider: "metaso",
        providerConfig: {
          apiKey: "test-metaso-key", // pragma: allowlist secret
          baseUrl: "https://metaso.cn",
          includeSummary: true,
        },
      }),
    );

    expect(res.ok).toBe(true);
  });

  it("accepts openai-search provider and config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            provider: "openai-search",
            openaiSearch: {
              apiKey: "test-key", // pragma: allowlist secret
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              model: "qwen-plus",
              toolName: "my-search",
              enableSearch: true,
              enableThinking: false,
              searchParam: "enable_search",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts qwen provider and config (deprecated alias)", () => {
    const res = validateConfigObject(
      buildWebSearchProviderConfig({
        enabled: true,
        provider: "qwen",
        providerConfig: {
          apiKey: "test-qwen-key", // pragma: allowlist secret
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          model: "qwen-plus",
          enableThinking: false,
        },
      }),
    );

    expect(res.ok).toBe(true);
  });
});

describe("openai-search config resolution", () => {
  it("uses defaults when no config provided", () => {
    const config = resolveOpenAISearchConfig({});
    expect(resolveOpenAISearchBaseUrl(config)).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );
    expect(resolveOpenAISearchModel(config)).toBe("qwen-plus");
    expect(resolveOpenAISearchToolName(config)).toBe("openai-search");
    expect(resolveOpenAISearchEnableSearch(config)).toBe(true);
    expect(resolveOpenAISearchEnableThinking(config)).toBe(false);
    expect(resolveOpenAISearchSearchParam(config)).toBe("enable_search");
  });

  it("uses custom baseUrl, model, toolName, searchParam", () => {
    const config = resolveOpenAISearchConfig({
      openaiSearch: {
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        toolName: "deepseek-search",
        searchParam: "web_search",
      },
    } as Record<string, unknown>);
    expect(resolveOpenAISearchBaseUrl(config)).toBe("https://api.deepseek.com/v1");
    expect(resolveOpenAISearchModel(config)).toBe("deepseek-chat");
    expect(resolveOpenAISearchToolName(config)).toBe("deepseek-search");
    expect(resolveOpenAISearchSearchParam(config)).toBe("web_search");
  });

  it("falls back to qwen config when openaiSearch is absent", () => {
    const config = resolveOpenAISearchConfig({
      qwen: {
        apiKey: "qwen-key", // pragma: allowlist secret
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-max",
        enableThinking: true,
      },
    } as Record<string, unknown>);
    expect(resolveOpenAISearchModel(config)).toBe("qwen-max");
    expect(resolveOpenAISearchEnableThinking(config)).toBe(true);
  });

  it("prefers openaiSearch over qwen when both present", () => {
    const config = resolveOpenAISearchConfig({
      openaiSearch: {
        model: "custom-model",
      },
      qwen: {
        model: "qwen-plus",
      },
    } as Record<string, unknown>);
    expect(resolveOpenAISearchModel(config)).toBe("custom-model");
  });
});

describe("openai-search API key resolution", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_SEARCH_API_KEY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns config apiKey when set", () => {
    expect(resolveOpenAISearchApiKey({ apiKey: "from-config" })).toBe("from-config"); // pragma: allowlist secret
  });

  it("falls back to DASHSCOPE_API_KEY env var", () => {
    process.env.DASHSCOPE_API_KEY = "from-dashscope-env"; // pragma: allowlist secret
    expect(resolveOpenAISearchApiKey({})).toBe("from-dashscope-env");
  });

  it("falls back to OPENAI_SEARCH_API_KEY env var", () => {
    process.env.OPENAI_SEARCH_API_KEY = "from-openai-search-env"; // pragma: allowlist secret
    expect(resolveOpenAISearchApiKey({})).toBe("from-openai-search-env");
  });

  it("DASHSCOPE_API_KEY takes priority over OPENAI_SEARCH_API_KEY", () => {
    process.env.DASHSCOPE_API_KEY = "dashscope"; // pragma: allowlist secret
    process.env.OPENAI_SEARCH_API_KEY = "openai-search"; // pragma: allowlist secret
    expect(resolveOpenAISearchApiKey({})).toBe("dashscope");
  });

  it("returns undefined when no key available", () => {
    expect(resolveOpenAISearchApiKey({})).toBeUndefined();
  });
});

describe("web search provider auto-detection", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BRAVE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.KIMI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.KIMI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.METASO_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_SEARCH_API_KEY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
  });

  it("falls back to brave when no keys available", () => {
    expect(resolveSearchProvider({})).toBe("brave");
  });

  it("auto-detects brave when only BRAVE_API_KEY is set", () => {
    process.env.BRAVE_API_KEY = "test-brave-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("brave");
  });

  it("auto-detects gemini when only GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "test-gemini-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("gemini");
  });

  it("auto-detects kimi when only KIMI_API_KEY is set", () => {
    process.env.KIMI_API_KEY = "test-kimi-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("kimi");
  });

  it("auto-detects perplexity when only PERPLEXITY_API_KEY is set", () => {
    process.env.PERPLEXITY_API_KEY = "test-perplexity-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("perplexity");
  });

  it("auto-detects perplexity when only OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("perplexity");
  });

  it("auto-detects grok when only XAI_API_KEY is set", () => {
    process.env.XAI_API_KEY = "test-xai-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("grok");
  });

  it("auto-detects kimi when only KIMI_API_KEY is set", () => {
    process.env.KIMI_API_KEY = "test-kimi-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("kimi");
  });

  it("auto-detects kimi when only MOONSHOT_API_KEY is set", () => {
    process.env.MOONSHOT_API_KEY = "test-moonshot-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("kimi");
  });

  it("auto-detects metaso when only METASO_API_KEY is set", () => {
    process.env.METASO_API_KEY = "test-metaso-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("metaso");
  });

  it("auto-detects openai-search when only DASHSCOPE_API_KEY is set", () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("openai-search");
  });

  it("auto-detects openai-search when only OPENAI_SEARCH_API_KEY is set", () => {
    process.env.OPENAI_SEARCH_API_KEY = "test-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("openai-search");
  });

  it("follows priority order — brave wins when multiple keys available", () => {
    process.env.BRAVE_API_KEY = "test-brave-key"; // pragma: allowlist secret
    process.env.GEMINI_API_KEY = "test-gemini-key"; // pragma: allowlist secret
    process.env.PERPLEXITY_API_KEY = "test-perplexity-key"; // pragma: allowlist secret
    process.env.XAI_API_KEY = "test-xai-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("brave");
  });

  it("gemini wins over grok, kimi, and perplexity when brave unavailable", () => {
    process.env.GEMINI_API_KEY = "test-gemini-key"; // pragma: allowlist secret
    process.env.PERPLEXITY_API_KEY = "test-perplexity-key"; // pragma: allowlist secret
    process.env.XAI_API_KEY = "test-xai-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("gemini");
  });

  it("grok wins over kimi and perplexity when brave and gemini unavailable", () => {
    process.env.XAI_API_KEY = "test-xai-key"; // pragma: allowlist secret
    process.env.KIMI_API_KEY = "test-kimi-key"; // pragma: allowlist secret
    process.env.PERPLEXITY_API_KEY = "test-perplexity-key"; // pragma: allowlist secret
    expect(resolveSearchProvider({})).toBe("grok");
  });

  it("explicit provider always wins regardless of keys", () => {
    process.env.BRAVE_API_KEY = "test-brave-key"; // pragma: allowlist secret
    expect(
      resolveSearchProvider({ provider: "gemini" } as unknown as Parameters<
        typeof resolveSearchProvider
      >[0]),
    ).toBe("gemini");
  });

  it("explicit qwen provider maps to openai-search", () => {
    process.env.BRAVE_API_KEY = "test-brave-key"; // pragma: allowlist secret
    expect(
      resolveSearchProvider({ provider: "qwen" } as unknown as Parameters<
        typeof resolveSearchProvider
      >[0]),
    ).toBe("openai-search");
  });

  it("explicit openai-search provider works", () => {
    process.env.BRAVE_API_KEY = "test-brave-key"; // pragma: allowlist secret
    expect(
      resolveSearchProvider({ provider: "openai-search" } as unknown as Parameters<
        typeof resolveSearchProvider
      >[0]),
    ).toBe("openai-search");
  });
});
