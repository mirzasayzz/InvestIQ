"use client";

// ── Data visualization primitives ──────────────────────────────────────
// Palette validated for the dark surface (#0f0f12):
//   gold #b8842f · bull #27a86f · bear #d94f4f · info #7d8fd6

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { FactorScore, RiskItem } from "@/lib/agent/types";

/* ── Conviction gauge — 240° arc ─────────────────────────────────────── */

export function ConvictionGauge({
  value,
  label = "conviction",
  color = "var(--gold-bright)",
  size = 180,
}: {
  value: number;
  label?: string;
  color?: string;
  size?: number;
}) {
  const r = 74;
  const cx = 90;
  const cy = 90;
  const startAngle = -210; // degrees
  const sweep = 240;
  const circumference = (sweep / 360) * 2 * Math.PI * r;

  const arcPath = describeArc(cx, cy, r, startAngle, startAngle + sweep);

  return (
    <div
      className="relative"
      style={{ width: size, height: size * 0.82 }}
      role="img"
      aria-label={`${label}: ${value} out of 100`}
    >
      <svg viewBox="0 0 180 158" width={size} height={size * 0.878}>
        {/* track */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* value */}
        <motion.path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <CountUp
          value={value}
          className="font-mono text-5xl font-semibold tracking-tight"
        />
        <span className="microlabel mt-2">{label}</span>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/* ── Animated number ─────────────────────────────────────────────────── */

export function CountUp({
  value,
  className,
  duration = 1.4,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className ?? ""}`}>{display}</span>
  );
}

/* ── Factor score bars ───────────────────────────────────────────────── */

export function FactorBars({ factors }: { factors: FactorScore[] }) {
  return (
    <div className="flex flex-col gap-4">
      {factors.map((f, i) => (
        <div key={f.factor} className="group" title={f.note}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[13px] text-ink-secondary">{f.factor}</span>
            <span className="font-mono text-[13px] text-ink tabular-nums">
              {f.score}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  f.score >= 70
                    ? "linear-gradient(90deg, #b8842f, #e3b862)"
                    : f.score >= 45
                      ? "linear-gradient(90deg, #8f6d33, #b8842f)"
                      : "linear-gradient(90deg, #5d5648, #8f6d33)",
              }}
              initial={{ width: 0 }}
              whileInView={{ width: `${f.score}%` }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 1.1,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.15 + i * 0.09,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {f.note}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Bull / bear balance meter ───────────────────────────────────────── */

export function BalanceMeter({
  bull,
  bear,
  compact = false,
}: {
  bull: number; // 0-100
  bear: number; // 0-100
  compact?: boolean;
}) {
  const total = Math.max(1, bull + bear);
  const bullPct = (bull / total) * 100;

  return (
    <div aria-label={`Bull strength ${bull}, bear strength ${bear}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`font-mono tabular-nums ${compact ? "text-[11px]" : "text-[13px]"}`}
          style={{ color: "var(--bull-bright)" }}
        >
          ▲ {Math.round(bull)}
        </span>
        <span className="microlabel">bull · bear</span>
        <span
          className={`font-mono tabular-nums ${compact ? "text-[11px]" : "text-[13px]"}`}
          style={{ color: "var(--bear-bright)" }}
        >
          {Math.round(bear)} ▼
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden flex">
        <motion.div
          className="h-full"
          style={{ background: "var(--bull)", borderRadius: "999px 0 0 999px" }}
          animate={{ width: `calc(${bullPct}% - 1px)` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* 2px surface gap between the two fills */}
        <div className="h-full w-[2px] shrink-0" style={{ background: "var(--surface)" }} />
        <motion.div
          className="h-full flex-1"
          style={{ background: "var(--bear)", borderRadius: "0 999px 999px 0" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/* ── Risk matrix — severity × likelihood ─────────────────────────────── */

export function RiskMatrix({ risks }: { risks: RiskItem[] }) {
  const cell = 44;
  const pad = { left: 34, bottom: 30, top: 8, right: 8 };
  const w = pad.left + cell * 5 + pad.right;
  const h = pad.top + cell * 5 + pad.bottom;

  return (
    <div className="flex flex-col items-start gap-1">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-[300px]"
        role="img"
        aria-label="Risk matrix: likelihood versus severity"
      >
        {/* grid */}
        {Array.from({ length: 6 }).map((_, i) => (
          <g key={i} stroke="rgba(255,255,255,0.07)" strokeWidth="1">
            <line
              x1={pad.left}
              x2={pad.left + cell * 5}
              y1={pad.top + i * cell}
              y2={pad.top + i * cell}
            />
            <line
              x1={pad.left + i * cell}
              x2={pad.left + i * cell}
              y1={pad.top}
              y2={pad.top + cell * 5}
            />
          </g>
        ))}
        {/* danger wash, upper-right */}
        <rect
          x={pad.left + cell * 3}
          y={pad.top}
          width={cell * 2}
          height={cell * 2}
          fill="rgba(217,79,79,0.07)"
        />
        {/* axis labels */}
        <text
          x={pad.left + (cell * 5) / 2}
          y={h - 6}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.18em"
          fill="var(--ink-muted)"
          style={{ textTransform: "uppercase", fontFamily: "var(--font-geist-mono)" }}
        >
          LIKELIHOOD →
        </text>
        <text
          x={10}
          y={pad.top + (cell * 5) / 2}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.18em"
          fill="var(--ink-muted)"
          transform={`rotate(-90 10 ${pad.top + (cell * 5) / 2})`}
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          SEVERITY →
        </text>
        {/* risk dots */}
        {risks.map((r, i) => {
          // jitter overlapping identical cells slightly
          const overlapIdx = risks
            .slice(0, i)
            .filter(
              (o) => o.severity === r.severity && o.likelihood === r.likelihood
            ).length;
          const x =
            pad.left + (r.likelihood - 0.5) * cell + overlapIdx * 10 - (overlapIdx ? 5 : 0);
          const y = pad.top + (5 - r.severity + 0.5) * cell + overlapIdx * 8;
          const heat = (r.severity * r.likelihood) / 25;
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 240, damping: 18 }}
            >
              <title>{`${r.risk} — severity ${r.severity}/5, likelihood ${r.likelihood}/5`}</title>
              {/* 2px surface ring so overlapping dots stay separable */}
              <circle cx={x} cy={y} r={11} fill="var(--surface)" />
              <circle
                cx={x}
                cy={y}
                r={9}
                fill={`rgba(217,79,79,${0.25 + heat * 0.6})`}
                stroke="var(--bear-bright)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#fff"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                {i + 1}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Sentiment dot ───────────────────────────────────────────────────── */

export function SentimentDot({
  sentiment,
  size = 6,
}: {
  sentiment: "bull" | "bear" | "neutral";
  size?: number;
}) {
  const color =
    sentiment === "bull"
      ? "var(--bull-bright)"
      : sentiment === "bear"
        ? "var(--bear-bright)"
        : "var(--ink-muted)";
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: color }}
      aria-label={sentiment}
    />
  );
}
