import { createFileRoute } from "@tanstack/react-router";

/**
 * Health check for an outside monitor (UptimeRobot): 200 when the site and
 * the database answer, 503 otherwise. No personal data.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await Promise.race([
            sql.query("select 1"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 8000)),
          ]);
          const dbMs = Date.now() - started;
          return Response.json(
            { ok: true, db_ms: dbMs, time: new Date().toISOString() },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[health] database check failed", err);
          return Response.json(
            { ok: false, error: "database", time: new Date().toISOString() },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
