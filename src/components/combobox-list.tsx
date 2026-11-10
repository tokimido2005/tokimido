import { Check } from "lucide-react";
import { Command } from "cmdk";

export function ComboboxList({
  value,
  options,
  filtered,
  query,
  setQuery,
  select,
  allowCustom,
  searchPlaceholder,
  emptyText,
  customLabel,
}: {
  value: string;
  options: string[];
  filtered: string[];
  query: string;
  setQuery: (q: string) => void;
  select: (opt: string) => void;
  allowCustom: boolean;
  searchPlaceholder: string;
  emptyText: string;
  customLabel: (q: string) => string;
}) {
  return (
    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl glass-strong">
      <Command shouldFilter={false} className="text-navy">
        <Command.Input
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
              onSelect={() => select(opt)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm data-[selected=true]:bg-navy/8"
            >
              {opt}
              {value === opt ? <Check className="size-4 text-orange" /> : null}
            </Command.Item>
          ))}
          {filtered.length === 0 ? <Command.Empty className="px-3 py-3 text-sm text-muted">{emptyText}</Command.Empty> : null}
          {allowCustom && query.trim() && !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) ? (
            <Command.Item
              value={query.trim()}
              onSelect={() => select(query.trim())}
              className="cursor-pointer rounded-xl px-3 py-2 text-sm text-orange-deep data-[selected=true]:bg-orange/10"
            >
              {customLabel(query.trim())}
            </Command.Item>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}
