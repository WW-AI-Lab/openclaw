import {
  createPluginBackedWebSearchProvider,
  getScopedCredentialValue,
  setScopedCredentialValue,
} from "../../src/agents/tools/web-search-plugin-factory.js";
import { emptyPluginConfigSchema } from "../../src/plugins/config-schema.js";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";

const metasoPlugin = {
  id: "metaso",
  name: "Metaso Plugin",
  description: "Bundled Metaso web search plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerWebSearchProvider(
      createPluginBackedWebSearchProvider({
        id: "metaso",
        label: "Metaso Search",
        hint: "Chinese web search with AI summaries",
        envVars: ["METASO_API_KEY"],
        placeholder: "sk-...",
        signupUrl: "https://metaso.cn/",
        docsUrl: "https://docs.openclaw.ai/tools/web",
        autoDetectOrder: 50,
        getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "metaso"),
        setCredentialValue: (searchConfigTarget, value) =>
          setScopedCredentialValue(searchConfigTarget, "metaso", value),
      }),
    );
  },
};

export default metasoPlugin;
