import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { createMetasoWebSearchProvider } from "./src/metaso-web-search-provider.js";

export default definePluginEntry({
  id: "metaso",
  name: "Metaso Plugin",
  description: "Bundled Metaso web search plugin",
  register(api) {
    api.registerWebSearchProvider(createMetasoWebSearchProvider());
  },
});
