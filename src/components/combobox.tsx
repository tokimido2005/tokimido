import { lazy, Suspense, useMemo, useState, useRef, useEffect } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale";

// The searchable list (cmdk) is only downloaded when someone opens a field,
// not with every page. Hovering or focusing the field starts the download.
const loadList = () => import("@/components/combobox-list");
const ComboboxList = lazy(() => loadList().then((m) => ({ default: m.ComboboxList })));

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  allowCustom = false,
  disabled = false,
  emptyText,
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
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={() => void loadList()}
        onFocus={() => void loadList()}
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
        <Suspense fallback={<div className="absolute z-50 mt-2 h-24 w-full animate-pulse rounded-2xl glass-strong" />}>
          <ComboboxList
            value={value}
            options={options}
            filtered={filtered}
            query={query}
            setQuery={setQuery}
            select={select}
            allowCustom={allowCustom}
            searchPlaceholder={searchPlaceholder ?? t("combo.search")}
            emptyText={emptyText ?? t("combo.empty")}
            customLabel={(q) => t("combo.use", { q })}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
