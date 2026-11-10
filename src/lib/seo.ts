const SITE = "Rabotaem.md";
export const SITE_ORIGIN = "https://rabotaem.md";

type SeoOptions = {
  /** Path of the canonical URL (e.g. "/angajare"). Adds canonical + og:url. */
  path?: string;
  /** Keep the page out of Google (private or thin pages). */
  noindex?: boolean;
  /**
   * Romanian path of a page that also exists under /ru: adds hreflang links
   * so Google shows the Romanian or Russian version to the right people.
   */
  twin?: string;
};

/** Absolute URL on the public site; each path segment stays as given. */
export function siteUrl(path: string) {
  return `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
}

export function seoHead(title: string, description: string, opts: SeoOptions = {}) {
  const full = title.includes(SITE) ? title : `${title} · ${SITE}`;
  const url = opts.path ? siteUrl(opts.path) : null;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      ...(url ? [{ property: "og:url", content: url }] : []),
      ...(opts.noindex ? [{ name: "robots", content: "noindex" }] : []),
    ],
    links: [
      ...(url && !opts.noindex ? [{ rel: "canonical", href: url }] : []),
      ...(opts.twin && !opts.noindex
        ? [
            { rel: "alternate", hrefLang: "ro", href: siteUrl(opts.twin) },
            { rel: "alternate", hrefLang: "ru", href: siteUrl(opts.twin === "/" ? "/ru" : `/ru${opts.twin}`) },
            { rel: "alternate", hrefLang: "x-default", href: siteUrl(opts.twin) },
          ]
        : []),
    ],
  };
}

export function setClientSeo(title: string, description?: string) {
  if (typeof document === "undefined") return;
  const full = title.includes(SITE) ? title : `${title} · ${SITE}`;
  document.title = full;
  if (description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
  }
}

/**
 * Serialize structured data for a `<script type="application/ld+json">` body.
 * JSON.stringify alone is NOT safe inside HTML: a value containing
 * `</script>` closes the tag and lets attacker text run as JavaScript (job
 * titles and URL params flow in here). Escape every character that can end
 * the script element or break the HTML parser.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
