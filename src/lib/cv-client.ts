import { getCvFile } from "@/lib/cv";

/** Fetch a CV file and return a blob URL (caller revokes it). */
export async function cvFileUrl(id: number) {
  const f = await getCvFile({ data: { id } });
  const bin = atob(f.b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: f.mime || "application/octet-stream" }));
  return { url, name: f.name, mime: f.mime };
}

/** Download a CV file with its original name. */
export async function downloadCvFile(id: number) {
  const { url, name } = await cvFileUrl(id);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "CV";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error ?? new Error("read"));
    r.readAsDataURL(file);
  });
}

/** Shrink a phone photo of a paper CV so it uploads fast (keeps text readable). */
export async function shrinkCvImage(file: File): Promise<{ b64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { b64: url.replace(/^data:[^,]*,/, ""), mime: "image/jpeg" };
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
