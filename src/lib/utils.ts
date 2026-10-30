import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMdl(value: number) {
  return `${new Intl.NumberFormat("ro-MD").format(value)} MDL`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? "1 oră" : `${hours} ore`;
  if (rest === 0) return hourLabel;
  return `${hourLabel} ${rest} min`;
}

export function formatPeople(count: number) {
  if (count === 1) return "1 persoană";
  return `${count} persoane`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatJobDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatJobTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toDateInputValue(isoOrDate?: string | Date) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toTimeInputValue(isoOrDate?: string | Date) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) return "09:00";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function tomorrowDateInput() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
}

export function combineDateTime(date: string, time: string) {
  const [y, m, day] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0);
  return d.toISOString();
}

export async function compressPhotoFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 320;
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("canvas");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let quality = 0.72;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 170_000 && quality > 0.35) {
    quality -= 0.12;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (url.length > 180_000) throw new Error("too-big");
  return url;
}

