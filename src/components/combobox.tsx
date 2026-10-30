import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command } from "cmdk";
import { cn } from "@/lib/utils";

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Caută…",
  allowCustom = false,
  disabled = false,
  emptyText = "Nu s-a găsit",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "field flex items-center justify-between gap-2 text-left",
          !value && "text-subtle",
          disabled && "opacity-50",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Închide"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl glass-strong">
            <Command shouldFilter={false} className="text-navy">
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                className="h-11 w-full border-b border-navy/10 bg-transparent px-3 text-sm outline-none"
              />
              <Command.List className="max-h-64 overflow-y-auto p-1">
                {filtered.map((opt) => (
                  <Command.Item
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm data-[selected=true]:bg-navy/8"
                  >
                    {opt}
                    {value === opt ? <Check className="size-4 text-orange" /> : null}
                  </Command.Item>
                ))}
                {filtered.length === 0 ? (
                  <Command.Empty className="px-3 py-3 text-sm text-muted">
                    {emptyText}
                  </Command.Empty>
                ) : null}
                {allowCustom && query.trim() && !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) ? (
                  <Command.Item
                    value={query.trim()}
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="cursor-pointer rounded-xl px-3 py-2 text-sm text-orange data-[selected=true]:bg-orange/10"
                  >
                    Folosește „{query.trim()}”
                  </Command.Item>
                ) : null}
              </Command.List>
            </Command>
          </div>
        </>
      ) : null}
    </div>
  );
}
