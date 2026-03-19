import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { createOpenAISearchWebSearchProvider } from "./src/openai-search-web-search-provider.js";

export default definePluginEntry({
  id: "openai-search",
  name: "OpenAI-Compatible Search Plugin",
  description: "Bundled OpenAI-compatible search plugin (qwen/DashScope)",
  register(api) {
    api.registerWebSearchProvider(createOpenAISearchWebSearchProvider());
  },
});
