export type JobStatusFields = {
  status: string;
  people_needed: number;
  selected_count: number;
  starts_at?: string | null;
  kind?: string | null;
};

export type StatusKey = "active" | "almost" | "completed" | "expired" | "cancelled";

export function remainingSlots(job: JobStatusFields) {
  return Math.max(0, job.people_needed - job.selected_count);
}

export function isExpired(job: Pick<JobStatusFields, "status" | "starts_at" | "kind">) {
  if (job.status === "expired") return true;
  if (job.status === "cancelled" || job.status === "completed" || job.status === "closed") {
    return false;
  }
  if (job.kind === "oficial") return false;
  if (!job.starts_at) return false;
  const t = new Date(job.starts_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

export function jobStatusKey(job: JobStatusFields): StatusKey {
  if (job.status === "cancelled") return "cancelled";
  if (job.status === "completed" || job.status === "closed") return "completed";
  if (isExpired(job)) return "expired";
  const left = remainingSlots(job);
  if (left === 0) return "almost";
  if (left === 1 && job.people_needed > 1) return "almost";
  return "active";
}

export function jobStatusLabel(job: JobStatusFields) {
  const key = jobStatusKey(job);
  if (key === "cancelled") return "Anulat";
  if (key === "completed") return "Finalizat";
  if (key === "expired") return "Expirat";
  if (key === "almost") return "Aproape complet";
  return "Activ";
}

export function jobStatusTone(key: StatusKey | string): StatusKey {
  if (key === "active" || key === "Activ") return "active";
  if (key === "almost" || key === "Aproape complet") return "almost";
  if (key === "cancelled" || key === "Anulat") return "cancelled";
  if (key === "expired" || key === "Expirat") return "expired";
  return "completed";
}

export function formatSlots(job: JobStatusFields) {
  const left = remainingSlots(job);
  return `${left} din ${job.people_needed}`;
}

export function isPubliclyOpen(job: JobStatusFields) {
  if (job.status !== "open") return false;
  if (isExpired(job)) return false;
  return remainingSlots(job) > 0;
}

export function canReactivate(job: JobStatusFields) {
  if (job.status === "expired" || isExpired(job)) return true;
  return job.status === "completed" && remainingSlots(job) > 0;
}

export function canComplete(job: JobStatusFields) {
  if (job.status === "cancelled" || job.status === "completed" || job.status === "closed") {
    return false;
  }
  return job.status === "open" || job.status === "expired" || isExpired(job);
}

export function isUrgent(startsAt: string | null | undefined) {
  if (!startsAt) return false;
  const t = new Date(startsAt).getTime();
  return t > Date.now() && t <= Date.now() + 24 * 60 * 60 * 1000;
}

export function isSoon3h(startsAt: string | null | undefined) {
  if (!startsAt) return false;
  const t = new Date(startsAt).getTime();
  return t > Date.now() && t <= Date.now() + 3 * 60 * 60 * 1000;
}

export function isTodayChisinau(startsAt: string | null | undefined) {
  if (!startsAt) return false;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(start) === fmt.format(new Date());
}
