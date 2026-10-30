import type { ReactNode } from "react";
import { Shell } from "@/components/shell";

export function LegalPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{lead}</p>
        <article className="mt-6 space-y-5 rounded-[32px] p-5 text-sm leading-relaxed text-navy/85 glass sm:p-8">
          {children}
        </article>
      </main>
    </Shell>
  );
}

export function LegalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="mt-2 space-y-2 text-muted">{children}</div>
    </section>
  );
}
