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
