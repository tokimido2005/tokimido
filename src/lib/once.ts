/**
 * Run an async setup step once per server process (retry after a failure).
 * Schema checks like "create table if not exists" cost a round-trip and a lock
 * every time; the schema doesn't change while the process runs.
 */
export function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    p ??= fn().catch((err) => {
      p = null;
      throw err;
    });
    return p;
  };
}
