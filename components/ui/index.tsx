"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared UI primitives for the FlowX platform.
 * Keeps Scout / Track / Content / Settings visually consistent on the same
 * "instrument" glass design language.
 */

/** Frosted glass panel - the standard surface for grouped content. */
export function Panel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={`instrument rounded-xl ${className}`}>{children}</Tag>;
}

type VerdictTone = "good" | "warn" | "bad" | "neutral";

const TONE_CLS: Record<VerdictTone, string> = {
  good: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
  warn: "bg-amber-900/40 text-amber-300 border-amber-700/50",
  bad: "bg-red-900/40 text-red-300 border-red-700/50",
  neutral: "bg-raised/60 text-dim border-edge",
};

/** Small status pill. Use for verdicts, states, counts. */
export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: VerdictTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TONE_CLS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A labelled metric tile. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`instrument rounded-lg px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className={`text-2xl font-extrabold font-mono mt-0.5 tracking-tight ${tone ?? "text-ink"}`}>{value}</p>
      {sub && <p className="text-[11px] text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

/** Segmented (radio-style) control for small enumerated choices. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center rounded-md border border-edge overflow-hidden ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`text-xs px-3 min-h-[44px] inline-flex items-center transition-colors ${
            value === o.value ? "bg-accent text-black font-semibold" : "text-dim hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Loading placeholder block with a subtle accent-tinted shimmer sweep. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

const SKELETON_LINE_W = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-3/4", "w-1/2"];

/** Stat-tile placeholder - mirrors <StatTile> on the elevated glass surface. */
export function SkeletonStatTile({ className = "" }: { className?: string }) {
  return (
    <div className={`instrument rounded-lg px-3 py-3 ${className}`}>
      <Skeleton className="h-2.5 w-2/3" />
      <Skeleton className="h-6 w-1/2 mt-2.5" />
      <Skeleton className="h-2 w-3/4 mt-2.5" />
    </div>
  );
}

/** Panel placeholder - an .instrument card with a heading + a few body lines. */
export function SkeletonPanel({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`instrument rounded-xl p-4 ${className}`}>
      <Skeleton className="h-3 w-32" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${SKELETON_LINE_W[i % SKELETON_LINE_W.length]}`} />
        ))}
      </div>
    </div>
  );
}

/** Stack of table/list row placeholders - badge + label + two metric cells. */
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`p-4 space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md shrink-0" />
          <Skeleton className={`h-3 flex-1 ${SKELETON_LINE_W[i % SKELETON_LINE_W.length]}`} />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-black font-semibold hover:brightness-110",
  secondary: "border border-edge text-ink bg-raised/40 hover:border-accent/40",
  ghost: "text-dim hover:text-ink",
  danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  // Both keep a 44px minimum touch height; sm is just tighter horizontally.
  sm: "px-3 min-h-[44px] text-xs",
  md: "px-4 min-h-[44px] text-sm",
};

/**
 * Shared button primitive - enforces a 44px touch target and the FlowX accent
 * styling so modules stop hand-rolling sub-44px `py-1` buttons.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}

/**
 * Mobile-first stacked row that replaces a desktop table row on small screens.
 * Pair with a `hidden lg:block` table + `lg:hidden` card list (see Track/Scout).
 */
export function MobileCard({
  children,
  active,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-active={active ? "true" : undefined}
      className={`mobile-data-card w-full text-left ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
