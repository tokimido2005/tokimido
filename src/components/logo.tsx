import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-9 w-auto sm:h-10",
  md: "h-11 w-auto max-w-[min(11rem,calc(100vw-12rem))] sm:h-12 sm:max-w-none",
  lg: "h-12 w-auto sm:h-[3.4rem]",
  hero: "h-[4.5rem] w-auto sm:h-[5.75rem] md:h-[6.75rem]",
} as const;

const TAG = {
  sm: "mt-0.5 text-[0.62rem] tracking-[0.08em] sm:text-[0.65rem] sm:tracking-[0.14em]",
  md: "mt-1 text-[0.68rem] tracking-[0.08em] sm:text-[0.75rem] sm:tracking-[0.18em]",
  lg: "mt-1 text-[0.72rem] tracking-[0.1em] sm:text-[0.82rem] sm:tracking-[0.18em]",
  hero: "mt-1.5 text-[0.78rem] tracking-[0.14em] sm:text-[0.95rem] sm:tracking-[0.22em] md:text-[1.05rem] md:tracking-[0.24em]",
} as const;

type LogoSize = keyof typeof SIZE;

/** Rendered width of the logo, so phones pick the small file. */
const SIZES: Record<LogoSize, string> = {
  sm: "160px",
  md: "(min-width: 640px) 200px, 176px",
  lg: "(min-width: 640px) 220px, 192px",
  hero: "(min-width: 768px) 430px, (min-width: 640px) 370px, 290px",
};

const LOGO_W = 1200;
const LOGO_H = 301;
const SLOGAN = "lucru pe loc. bani pe loc.";

function LogoImg({
  size,
  glow,
  priority,
}: {
  size: LogoSize;
  glow: boolean;
  priority: boolean;
}) {
  const cls = cn(
    "max-w-none object-contain object-left",
    SIZE[size],
    glow && (size === "hero" ? "logo-glow-hero" : "logo-glow"),
  );
  return (
    <>
      {/* The header logo is the first thing on screen: load it right away (not
          lazily) and in a phone-sized file; the 900px file is for big screens. */}
      <img
        src="/logo-600.webp?v=r6"
        srcSet="/logo-600.webp?v=r6 600w, /logo-900.webp?v=r5 900w"
        sizes={SIZES[size]}
        alt="Rabotaem.md"
        width={LOGO_W}
        height={LOGO_H}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn(cls, "dark:hidden")}
      />
      <img
        src="/logo-dark-600.webp?v=r6"
        srcSet="/logo-dark-600.webp?v=r6 600w, /logo-dark-900.webp?v=r5 900w"
        sizes={SIZES[size]}
        alt=""
        width={LOGO_W}
        height={LOGO_H}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        className={cn(cls, "hidden dark:block")}
        aria-hidden="true"
      />
    </>
  );
}

function Slogan({ size }: { size: LogoSize }) {
  return (
    <span className={cn("logo-tagline", TAG[size])} aria-hidden="true">
      {SLOGAN}
    </span>
  );
}

export function Logo({
  className,
  compact = false,
  size,
  glow = true,
  linked = true,
  priority = false,
}: {
  className?: string;
  compact?: boolean;
  size?: LogoSize;
  glow?: boolean;
  linked?: boolean;
  /** Above the fold (header): load immediately. */
  priority?: boolean;
}) {
  const resolved: LogoSize = size ?? (compact ? "sm" : "md");
  const inner = (
    <span className="logo-lockup">
      <LogoImg size={resolved} glow={glow} priority={priority} />
      <Slogan size={resolved} />
    </span>
  );

  if (!linked) {
    return <span className={cn("inline-flex shrink-0 items-center", className)}>{inner}</span>;
  }

  return (
    <Link
      to="/"
      className={cn("inline-flex shrink-0 items-center outline-none", className)}
      aria-label="Rabotaem.md — lucru pe loc. bani pe loc."
    >
      {inner}
    </Link>
  );
}

export function WelcomeLogo() {
  return (
    <div className="logo-welcome relative mb-6 inline-flex items-center sm:mb-8">
      <span
        className="pointer-events-none absolute top-[32%] left-[20%] -z-10 h-[62%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/25 blur-3xl"
        aria-hidden="true"
      />
      <Logo size="hero" linked={false} />
    </div>
  );
}

export function Mark({ className }: { className?: string }) {
  return <Logo size="md" className={className} glow />;
}
