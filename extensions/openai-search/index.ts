import {
  createPluginBackedWebSearchProvider,
  getScopedCredentialValue,
  setScopedCredentialValue,
} from "../../src/agents/tools/web-search-plugin-factory.js";
import { emptyPluginConfigSchema } from "../../src/plugins/config-schema.js";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";

function getOpenAISearchCredentialValue(searchConfig?: Record<string, unknown>): unknown {
  const openaiSearch = searchConfig?.openaiSearch;
  if (openaiSearch && typeof openaiSearch === "object" && !Array.isArray(openaiSearch)) {
    const val = (openaiSearch as Record<string, unknown>).apiKey;
    if (val !== undefined) {
      return val;
    }
  }
  // Fall back to deprecated qwen config
  return getScopedCredentialValue(searchConfig, "qwen");
}

function setOpenAISearchCredentialValue(
  searchConfigTarget: Record<string, unknown>,
  value: unknown,
): void {
  setScopedCredentialValue(searchConfigTarget, "openaiSearch", value);
  // Also write to deprecated qwen for backward compat
  setScopedCredentialValue(searchConfigTarget, "qwen", value);
}

const openaiSearchPlugin = {
  id: "openai-search",
  name: "OpenAI-Compatible Search Plugin",
  description: "Bundled OpenAI-compatible search plugin (qwen/DashScope)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerWebSearchProvider(
      createPluginBackedWebSearchProvider({
        id: "openai-search",
        label: "OpenAI-Compatible Search",
        hint: "DashScope/Qwen or any OpenAI-compatible search API",
        envVars: ["DASHSCOPE_API_KEY", "OPENAI_SEARCH_API_KEY"],
        placeholder: "sk-...",
        signupUrl: "https://dashscope.aliyun.com/",
        docsUrl: "https://docs.openclaw.ai/tools/web",
        autoDetectOrder: 55,
        getCredentialValue: getOpenAISearchCredentialValue,
        setCredentialValue: setOpenAISearchCredentialValue,
      }),
    );
  },
};

export default openaiSearchPlugin;
