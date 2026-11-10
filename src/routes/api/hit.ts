import { createFileRoute } from "@tanstack/react-router";

// Simple per-IP throttle (per server process): enough to stop a flood.
const hits = new Map<string, { n: number; at: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now - cur.at > 60_000) {
    hits.set(ip, { n: 1, at: now });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  cur.n += 1;
  return cur.n <= 120;
}

/**
 * Anonymous statistics beacon: page views and site searches. No cookies; see
 * src/lib/stats.server.ts. Always answers 204 so it never disturbs the page.
 */
export const Route = createFileRoute("/api/hit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const done = new Response(null, { status: 204 });
        try {
          const stats = await import("@/lib/stats.server");
          const ua = request.headers.get("user-agent") ?? "";
          if (stats.isBot(ua)) return done;
          const { clientIp } = await import("@/lib/sms.server");
          const ip = clientIp();
          if (!allowed(ip)) return done;
          const text = await request.text();
          if (text.length > 2000) return done;
          const body = JSON.parse(text) as Record<string, unknown>;
          const str = (v: unknown) => (typeof v === "string" ? v : "");
          if (body.t === "view") {
            await stats.recordView({
              path: str(body.path),
              referrer: str(body.ref).slice(0, 300),
              utm: str(body.utm).slice(0, 40),
              internal: body.internal === true,
              ip,
              ua,
              host: new URL(request.url).hostname,
            });
          } else if (body.t === "search") {
            await stats.recordSearch({
              q: str(body.q),
              kind: str(body.kind),
              results: typeof body.n === "number" ? body.n : 0,
            });
          }
        } catch (err) {
          console.warn("[hit]", err instanceof Error ? err.message : err);
        }
        return done;
      },
    },
  },
});
