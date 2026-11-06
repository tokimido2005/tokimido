const SITE = "Rabotaem.md";

export function seoHead(title: string, description: string) {
  const full = title.includes(SITE) ? title : `${title} · ${SITE}`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
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
