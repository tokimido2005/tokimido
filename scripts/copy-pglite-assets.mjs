#!/usr/bin/env node
/**
 * Vercel export helper. The function bundle does not keep pglite.data /
 * pglite.wasm next to the emitted JS, so PGLite throws ENOENT on cold start.
 * Copy the engine files (not a database) and migrations into the function dir.
 * The app creates the actual database under /tmp on first request.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const server = join(process.cwd(), ".vercel/output/functions/__server.func");
if (!existsSync(server)) {
  console.log("[pglite] no Vercel function output — skipping asset copy");
  process.exit(0);
}

const dest = join(server, "pglite-assets");
mkdirSync(dest, { recursive: true });
const src = join(process.cwd(), "node_modules/@electric-sql/pglite/dist");
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const from = join(src, name);
  if (!existsSync(from)) {
    console.error("[pglite] missing", from);
    process.exit(1);
  }
  cpSync(from, join(dest, name));
}
cpSync(join(process.cwd(), "migrations"), join(server, "migrations"), { recursive: true });
console.log("[pglite] copied engine assets and migrations into the Vercel function");

// Vite also emits the engine files into the public client bundle even though no
// page loads them. Drop those copies so the export does not ship them twice.
const publicAssets = join(process.cwd(), ".vercel/output/static/assets");
if (existsSync(publicAssets)) {
  for (const name of readdirSync(publicAssets)) {
    if (/^(pglite|initdb)-.+\.(data|wasm)$/.test(name)) {
      unlinkSync(join(publicAssets, name));
      console.log("[pglite] removed unused client asset", name);
    }
  }
}
