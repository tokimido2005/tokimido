import { Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CATEGORIES } from "@/lib/categories";
import { OFFICIAL_CATEGORIES } from "@/lib/job-kinds";
import { RAION_NAMES, localitiesFor } from "@/lib/moldova";
import { requestBrowserRaion } from "@/lib/geo";
import { Combobox } from "@/components/combobox";
import { useT } from "@/lib/locale";

export type JobFilters = {
  q: string;
  raion: string;
  locality: string;
  category: string;
  when: "" | "today" | "urgent" | "soon3h";
};

export function Filters({
  value,
  onChange,
  variant = "rapid",
}: {
  value: JobFilters;
  onChange: (next: JobFilters) => void;
  variant?: "rapid" | "oficial";
}) {
  const { t } = useT();
  const localities = value.raion ? localitiesFor(value.raion) : [];
  const [locating, setLocating] = useState(false);
  const [nearOn, setNearOn] = useState(false);

  function patch(part: Partial<JobFilters>) {
    onChange({ ...value, ...part });
  }

  const active =
    Boolean(value.q) || Boolean(value.raion) || Boolean(value.locality) || Boolean(value.category) || Boolean(value.when);

  return (
    <div className="rounded-[24px] p-3 glass sm:p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="relative md:col-span-2">
          <span className="sr-only">{variant === "oficial" ? t("search.labelOficial") : t("search.label")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-10"
            placeholder={variant === "oficial" ? t("search.placeholderOficial") : t("search.placeholder")}
            value={value.q}
            onChange={(e) => patch({ q: e.target.value })}
          />
        </label>
        <Combobox
          value={value.raion}
          onChange={(raion) => patch({ raion, locality: "" })}
          options={RAION_NAMES}
          placeholder={t("search.allRaions")}
          searchPlaceholder={t("search.allRaions")}
        />
        {value.raion ? (
          <Combobox
            value={value.locality}
            onChange={(locality) => patch({ locality })}
            options={localities}
            placeholder={t("search.allPlaces")}
            searchPlaceholder={t("search.allPlaces")}
            allowCustom
          />
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip
          active={!value.category}
          onClick={() => patch({ category: "" })}
          label={t("search.all")}
        />
        {variant === "oficial"
          ? OFFICIAL_CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={value.category === c.id}
                onClick={() => patch({ category: value.category === c.id ? "" : c.id })}
                label={t(`ocat.${c.id}`)}
              />
            ))
          : CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={value.category === c.id}
                onClick={() => patch({ category: value.category === c.id ? "" : c.id })}
                label={t(`cat.${c.id}`)}
              />
            ))}
        {variant === "rapid" ? (
          <>
            <Chip
              active={value.when === "soon3h"}
              onClick={() => patch({ when: value.when === "soon3h" ? "" : "soon3h" })}
              label={t("search.soon3h")}
            />
            <Chip
              active={value.when === "today"}
              onClick={() => patch({ when: value.when === "today" ? "" : "today" })}
              label={t("search.today")}
            />
            <Chip
              active={value.when === "urgent"}
              onClick={() => patch({ when: value.when === "urgent" ? "" : "urgent" })}
              label={t("search.urgent")}
            />
          </>
        ) : null}
        <Chip
          active={nearOn}
          onClick={() => {
            if (nearOn) {
              setNearOn(false);
              patch({ raion: "", locality: "" });
              return;
            }
            setLocating(true);
            requestBrowserRaion()
              .then((raion) => {
                setNearOn(true);
                try {
                  window.localStorage.setItem("rabotaem-near-raion", raion);
                } catch {
                  /* ignore */
                }
                patch({ raion, locality: "" });
              })
              .catch(() => {
                setNearOn(false);
                toast.error(t("search.geoDenied"));
              })
              .finally(() => setLocating(false));
          }}
          label={locating ? t("search.locating") : t("search.near")}
        />
        {active ? (
          <button
            type="button"
            onClick={() => onChange({ q: "", raion: "", locality: "", category: "", when: "" })}
            className="ml-auto inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:text-navy"
          >
            <X className="size-3.5" />
            {t("search.reset")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-10 rounded-full bg-brand px-3.5 text-sm font-semibold text-white"
          : "h-10 rounded-full bg-white/45 px-3.5 text-sm font-medium text-navy/80 ring-1 ring-navy/8 hover:bg-white/70 dark:bg-white/8 dark:hover:bg-white/14"
      }
    >
      {label}
    </button>
  );
}
