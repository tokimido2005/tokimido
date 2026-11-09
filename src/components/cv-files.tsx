import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CV_FILE_MAX, CV_FILE_TYPES, deleteCvFile, uploadCvFile, type CvFileMeta } from "@/lib/cv";
import { downloadCvFile, formatSize, readFileAsBase64, shrinkCvImage } from "@/lib/cv-client";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function guessMime(file: File) {
  if (file.type) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".doc")) return "application/msword";
  return "";
}

/** Big "upload your CV" button: PDF, Word or a photo of a paper CV. */
export function CvUploadButton({
  onUploaded,
  className,
  label,
}: {
  onUploaded: (file: CvFileMeta) => void;
  className?: string;
  label?: string;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    let mime = guessMime(file);
    if (!CV_FILE_TYPES[mime]) {
      toast.error(t("cv.errType"));
      return;
    }
    setBusy(true);
    try {
      let b64: string;
      let size = file.size;
      if (mime.startsWith("image/")) {
        const img = await shrinkCvImage(file);
        b64 = img.b64;
        mime = img.mime;
        size = Math.round((b64.length * 3) / 4);
      } else {
        if (file.size > CV_FILE_MAX) {
          toast.error(t("cv.errSize"));
          return;
        }
        b64 = await readFileAsBase64(file);
      }
      const name = mime === "image/jpeg" && !/\.jpe?g$/i.test(file.name) ? `${file.name.replace(/\.[^.]+$/, "")}.jpg` : file.name;
      const res = await uploadCvFile({ data: { name, mime, b64 } });
      toast.success(t("cv.uploaded"));
      onUploaded({ id: res.id, name, mime, size, created_at: new Date().toISOString() });
    } catch (err) {
      toast.error(errorText(err, t, t("cv.uploadFail")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        data-testid="cv-upload"
        className={cn(
          "flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 text-base font-semibold text-navy ring-2 ring-navy/20 hover:bg-navy/5 disabled:opacity-60",
          className,
        )}
      >
        <Upload className="size-5" />
        {busy ? t("cv.uploading") : (label ?? t("cv.uploadBtn"))}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        data-testid="cv-upload-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
    </>
  );
}

export function CvFileRow({
  file,
  onDeleted,
  selected,
  onSelect,
}: {
  file: CvFileMeta;
  onDeleted?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useT();
  const Icon = file.mime.startsWith("image/") ? ImageIcon : FileText;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3 ring-1",
        selected ? "bg-[#1d6fd8]/8 ring-2 ring-[#1d6fd8]" : "bg-white/60 ring-navy/10 dark:bg-white/8",
      )}
      data-testid="cv-file-row"
    >
      {onSelect ? (
        <input type="radio" className="size-5" checked={Boolean(selected)} onChange={onSelect} aria-label={file.name} />
      ) : null}
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy/8 text-navy">
        <Icon className="size-5" />
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-medium text-navy">{file.name}</span>
        <span className="text-sm text-muted">
          {CV_FILE_TYPES[file.mime] ?? ""} · {formatSize(file.size)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void downloadCvFile(file.id).catch(() => toast.error(t("cv.errNotFound")))}
        aria-label={t("cv.download")}
        className="grid size-11 shrink-0 place-items-center rounded-full text-navy hover:bg-navy/8"
      >
        <Download className="size-5" />
      </button>
      {onDeleted ? (
        <button
          type="button"
          aria-label={t("cv.remove")}
          onClick={() => {
            if (!window.confirm(t("cv.deleteFileConfirm"))) return;
            deleteCvFile({ data: { id: file.id } })
              .then(() => onDeleted())
              .catch((err: unknown) => toast.error(errorText(err, t, t("error.update"))));
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-danger/8 hover:text-danger"
        >
          <Trash2 className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
