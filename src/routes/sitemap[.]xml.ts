import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES } from "@/lib/categories";
import { RAION_NAMES } from "@/lib/moldova";

const SITE = "https://rabotaem.md";

const STATIC_PAGES: Array<[path: string, changefreq: string, priority: string]> = [
  ["/", "hourly", "1.0"],
  ["/angajare", "hourly", "0.9"],
  ["/post", "weekly", "0.6"],
  ["/faq", "monthly", "0.5"],
  ["/contact", "monthly", "0.4"],
  ["/termeni", "yearly", "0.2"],
  ["/confidentialitate", "yearly", "0.2"],
  ["/disclaimer", "yearly", "0.2"],
];

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function entry(path: string, changefreq: string, priority: string, lastmod?: string) {
  return `  <url><loc>${xmlEscape(SITE + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

/**
 * Dynamic sitemap: static pages, every category and raion landing page, and
 * every open public job (both feeds). Replaces the old hand-written file.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC_PAGES.map(([p, f, pr]) => entry(p, f, pr));
        for (const c of CATEGORIES) urls.push(entry(`/c/${encodeURIComponent(c.id)}`, "daily", "0.7"));
        for (const r of RAION_NAMES) urls.push(entry(`/r/${encodeURIComponent(r)}`, "daily", "0.6"));
        try {
          const { listJobs } = await import("@/lib/jobs");
          for (const kind of ["rapid", "oficial"] as const) {
            const jobs = await listJobs({ data: { kind } });
            for (const job of jobs) {
              const lastmod = new Date(job.created_at).toISOString().slice(0, 10);
              urls.push(entry(`/jobs/${job.id}`, "daily", "0.8", lastmod));
            }
          }
        } catch (err) {
          console.error("[sitemap] jobs failed", err);
        }
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
