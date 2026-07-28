import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

// The engine library lives one level up from `web/`. We alias `@engine` to it
// so the React island can import the parsers / estimators / pricing directly —
// no publish step, no vendored copy. All of that code is pure and runs in the
// browser, which is what preserves the zero-trust ("nothing leaves your
// machine") guarantee.
const engineRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  // Overridden at build time via PUBLIC_SITE_URL and PUBLIC_SITE_BASE environment variables
  // GitHub Pages: https://ninjapaw.github.io/sentinel-optimizer/
  // Production: https://sentinel-optimizer.com
  // Cloudflare Pages dev: https://sentinel-optimizer-site.pages.dev
  site: process.env.PUBLIC_SITE_URL ?? "https://ninjapaw.github.io/sentinel-optimizer",
  base: process.env.PUBLIC_SITE_BASE ?? "/sentinel-optimizer/",
  integrations: [react()],
  vite: {
    resolve: {
      alias: { "@engine": engineRoot },
    },
    server: {
      // Allow Vite's dev server to read the engine source that lives outside
      // the `web/` root.
      fs: { allow: [engineRoot] },
    },
  },
});
