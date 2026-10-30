import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center text-navy">
      <span className="text-orange" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Ceva n-a mers</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error instanceof Error && error.message
          ? error.message
          : "A apărut o eroare neașteptată. Reîncarcă pagina."}
      </p>
    </main>
  );
}
