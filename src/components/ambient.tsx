export function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-canvas" />
      <div className="absolute -top-32 -left-24 size-[34rem] rounded-full bg-orange/20 blur-3xl float-a dark:bg-orange/25" />
      <div className="absolute -top-20 right-[-8rem] size-[38rem] rounded-full bg-navy/15 blur-3xl float-b dark:bg-brand/40" />
      <div className="absolute bottom-[-10rem] left-1/3 size-[32rem] rounded-full bg-navy-soft/15 blur-3xl float-a dark:bg-orange/10" />
      <div className="absolute top-1/3 right-1/4 size-64 rounded-full bg-white/40 blur-3xl float-b dark:bg-white/8" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--dot-grid) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}
