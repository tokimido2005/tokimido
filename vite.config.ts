import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { readdirSync } from "node:fs";

function publicCacheRules() {
  const rules: Record<string, { headers: Record<string, string> }> = {};
  for (const name of readdirSync("public")) {
    if (/\.(webp|png|jpg|svg|ico)$/.test(name)) {
      rules[`/${name}`] = { headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" } };
    }
  }
  return rules;
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

export default defineConfig(({ command }) => ({
server: {
  host: "0.0.0.0",
  port: 8080,
  strictPort: true,
  allowedHosts: ["tokimido.onrender.com", "localhost"],
},
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build"
      ? [
          nitro({
            preset: "node-server",
            // Auto-registers server/middleware/* (security headers).
            serverDir: "./server",
            // Ship .br/.gz copies of JS, CSS and fonts so phones download ~4x less.
            compressPublicAssets: { gzip: true, brotli: true },
            // Logos, icons and images in /public: phones keep them for a week
            // (they get a new name or ?v= when replaced).
            routeRules: publicCacheRules(),
          }),
        ]
      : []),
    viteReact(),
  ],
}));
