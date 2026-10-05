// Shared UI building blocks. No hooks here, so these work in both Server and
// Client Components. Interactive ones (Stepper) are only used from client code.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { dateParts } from "@/lib/format";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  { size = "md", full = false }: { size?: "md" | "lg"; full?: boolean } = {}
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40",
    size === "lg" ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm",
    full && "w-full",
    variant === "primary" &&
      "bg-linear-to-r from-violet-600 via-fuchsia-500 to-orange-400 text-white shadow-lg shadow-fuchsia-500/25 hover:brightness-110",
    variant === "secondary" && "bg-surface text-foreground ring-1 ring-line hover:bg-surface-2",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-foreground",
    variant === "danger" && "bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
  );
}

export function Button({
  variant = "primary",
  size,
  full,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  full?: boolean;
}) {
  return <button className={cn(buttonClasses(variant, { size, full }), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Surfaces & text
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-surface p-5 shadow-sm shadow-violet-900/5 ring-1 ring-line",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-display text-lg font-semibold">{children}</h2>;
}

export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-5xl">{emoji}</span>
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <div className="text-muted">{children}</div>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const inputClasses = cn(
  "w-full rounded-2xl bg-surface-2 px-4 py-3 text-base text-foreground ring-1 ring-line",
  "placeholder:text-muted/70 transition",
  "focus:bg-surface focus:outline-none focus:ring-2 focus:ring-violet-500"
);

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  const btn =
    "grid size-8 place-items-center rounded-full bg-surface text-lg font-bold ring-1 ring-line transition active:scale-90 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-1 pl-3">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        className={btn}
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <span className="w-5 text-center font-bold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`More ${label}`}
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chips, avatars, dates
// ---------------------------------------------------------------------------

const CHIP_TONES = {
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  neutral: "bg-surface-2 text-muted",
} as const;

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof CHIP_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        CHIP_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-orange-400",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  // Small avatars overlap in stacks, so they show a single initial.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, size === "sm" ? 1 : 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      title={name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-surface",
        AVATAR_COLORS[hash(name) % AVATAR_COLORS.length],
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-14 text-xl"
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size="sm" />
      ))}
      {extra > 0 && (
        <span className="inline-grid size-7 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-muted ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Tear-off-calendar style date badge. */
export function CalendarTile({
  iso,
  allDay,
  className,
}: {
  iso: string;
  allDay: boolean;
  className?: string;
}) {
  const p = dateParts(iso, allDay);
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col overflow-hidden rounded-2xl bg-surface text-center ring-1 ring-line",
        className
      )}
    >
      <span className="bg-linear-to-r from-violet-600 to-fuchsia-500 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase">
        {p.month}
      </span>
      <span className="font-display text-2xl leading-tight font-semibold">{p.day}</span>
      <span className="pb-1 text-[10px] font-bold text-muted uppercase">{p.weekday}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-event color themes (stable per event id)
// ---------------------------------------------------------------------------

const EVENT_THEMES = [
  { card: "bg-violet-500/10 ring-violet-500/20", emoji: "bg-violet-500/15" },
  { card: "bg-fuchsia-500/10 ring-fuchsia-500/20", emoji: "bg-fuchsia-500/15" },
  { card: "bg-orange-400/12 ring-orange-400/25", emoji: "bg-orange-400/20" },
  { card: "bg-sky-500/10 ring-sky-500/20", emoji: "bg-sky-500/15" },
  { card: "bg-emerald-500/10 ring-emerald-500/20", emoji: "bg-emerald-500/15" },
  { card: "bg-amber-400/12 ring-amber-400/25", emoji: "bg-amber-400/20" },
];

export function eventTheme(id: string) {
  return EVENT_THEMES[hash(id) % EVENT_THEMES.length];
}
