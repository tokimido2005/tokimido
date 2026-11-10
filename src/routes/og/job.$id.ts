import { createFileRoute } from "@tanstack/react-router";

// Small in-memory cache: a shared link is fetched by many previewers at once.
const cache = new Map<string, Buffer>();

/** Preview image for a job link (og:image), 1200×630 PNG. */
export const Route = createFileRoute("/og/job/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        const fallback = () => Response.redirect(new URL("/og.jpg", "https://rabotaem.md").toString(), 302);
        if (!Number.isInteger(id) || id <= 0) return fallback();
        try {
          const { getJob } = await import("@/lib/jobs");
          const job = await getJob({ data: id });
          if (!job) return fallback();
          const og = await import("@/lib/og-image.server");
          const key = og.jobImageKey(job);
          let png = cache.get(key);
          if (!png) {
            png = await og.renderJobImage(job);
            if (cache.size > 300) cache.clear();
            cache.set(key, png);
          }
          return new Response(new Uint8Array(png), {
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
            },
          });
        } catch (err) {
          console.error("[og] job image", err);
          return fallback();
        }
      },
    },
  },
});
