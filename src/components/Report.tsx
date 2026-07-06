"use client";

// ── Act III: the decision memo ─────────────────────────────────────────
// A committee-grade report: verdict hero, thesis, factor scores, both
// sides of the debate, the risk register, and what would change our mind.

import { motion } from "motion/react";
import type { Report } from "@/lib/agent/types";
import {
  BalanceMeter,
  ConvictionGauge,
  FactorBars,
  RiskMatrix,
  SentimentDot,
} from "./viz";
import { Brand, Signature } from "./Brand";

const DECISION_STYLE: Record<
  Report["verdict"]["decision"],
  { color: string; soft: string; word: string }
> = {
  INVEST: { color: "var(--bull-bright)", soft: "rgba(39,168,111,0.12)", word: "Invest" },
  PASS: { color: "var(--bear-bright)", soft: "rgba(217,79,79,0.12)", word: "Pass" },
  WATCH: { color: "var(--gold-bright)", soft: "rgba(227,184,98,0.12)", word: "Watch" },
};

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function ReportView({
  report,
  onNew,
}: {
  report: Report;
  onNew: () => void;
}) {
  const { profile, verdict, bull, bear, risks, sources, findings } = report;
  const d = DECISION_STYLE[verdict.decision];
  const date = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.main
      className="min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/30 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <Brand onHome={onNew} />
          <div className="flex items-center gap-3">
            <span className="microlabel hidden sm:block">committee memo · {date}</span>
            <button
              onClick={onNew}
              className="glass rounded-full px-4 py-2 text-[12.5px] text-ink-secondary hover:text-ink hover:border-white/25 transition-all cursor-pointer"
            >
              New analysis
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24">
        {/* ── verdict hero ─────────────────────────────────────────── */}
        <section className="pt-16 pb-12 grid md:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <motion.div
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <span
                className="font-mono text-[11px] tracking-[0.28em] uppercase px-3.5 py-1.5 rounded-full"
                style={{ color: d.color, background: d.soft, border: `1px solid ${d.color}40` }}
              >
                {verdict.decision}
              </span>
              <span className="text-[13px] text-ink-muted">
                {profile.name}
                {profile.ticker ? ` · ${profile.ticker}` : ""} · {profile.sector}
              </span>
            </motion.div>

            <motion.h1
              className="serif-display text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.12] tracking-tight"
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {verdict.headline}
            </motion.h1>

            <motion.div
              className="mt-7 flex flex-wrap gap-x-8 gap-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
            >
              <HeroMeta label="decision" value={d.word} color={d.color} />
              <HeroMeta label="horizon" value={verdict.horizon} />
              <HeroMeta label="evidence" value={`${findings.length} findings`} />
              {sources.length > 0 && (
                <HeroMeta label="sources" value={`${sources.length} live`} />
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="justify-self-center"
          >
            <ConvictionGauge value={verdict.conviction} color={d.color} size={200} />
          </motion.div>
        </section>

        {/* ── thesis ───────────────────────────────────────────────── */}
        <motion.section {...rise()} className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${d.color}66, transparent)` }}
          />
          <p className="microlabel mb-4">the thesis</p>
          <p className="serif-display text-[19px] md:text-[21px] leading-[1.65] text-ink/95">
            {verdict.thesis}
          </p>
        </motion.section>

        {/* ── factors + debate balance ─────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <motion.section {...rise(0.05)} className="glass rounded-3xl p-8">
            <p className="microlabel mb-6">factor scores</p>
            <FactorBars factors={verdict.factors} />
          </motion.section>

          <div className="flex flex-col gap-4">
            <motion.section {...rise(0.1)} className="glass rounded-3xl p-8">
              <p className="microlabel mb-5">committee balance</p>
              <BalanceMeter bull={bull.conviction} bear={bear.conviction} />
              <p className="mt-5 text-[13px] leading-relaxed text-ink-secondary">
                The bull desk argued at{" "}
                <span style={{ color: "var(--bull-bright)" }}>{bull.conviction}/100</span>{" "}
                conviction against the bear desk&apos;s{" "}
                <span style={{ color: "var(--bear-bright)" }}>{bear.conviction}/100</span>.
                The committee settled on{" "}
                <span style={{ color: d.color }}>{d.word.toLowerCase()}</span> at{" "}
                {verdict.conviction}/100.
              </p>
            </motion.section>

            <motion.section {...rise(0.15)} className="glass rounded-3xl p-8 flex-1">
              <p className="microlabel mb-5">what would change our mind</p>
              <ul className="flex flex-col gap-3.5">
                {verdict.wouldChangeMind.map((w, i) => (
                  <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-secondary">
                    <span className="font-mono text-[11px] mt-0.5 shrink-0" style={{ color: "var(--gold)" }}>
                      →
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </motion.section>
          </div>
        </div>

        {/* ── the debate ───────────────────────────────────────────── */}
        <motion.p {...rise()} className="microlabel mt-14 mb-5 text-center">
          the debate
        </motion.p>
        <div className="grid md:grid-cols-2 gap-4">
          <CaseColumn side="bull" summary={bull.summary} points={bull.points} />
          <CaseColumn side="bear" summary={bear.summary} points={bear.points} />
        </div>

        {/* ── risk register ────────────────────────────────────────── */}
        <motion.section {...rise()} className="glass rounded-3xl p-8 md:p-10 mt-14">
          <p className="microlabel mb-7">risk register</p>
          <div className="grid md:grid-cols-[300px_1fr] gap-8 items-start">
            <RiskMatrix risks={risks} />
            <ol className="flex flex-col gap-5">
              {risks.map((r, i) => (
                <motion.li key={i} {...rise(0.05 * i)} className="flex gap-3.5">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 font-mono text-[11px] font-semibold mt-0.5"
                    style={{
                      background: `rgba(217,79,79,${0.15 + ((r.severity * r.likelihood) / 25) * 0.4})`,
                      color: "var(--bear-bright)",
                      border: "1px solid rgba(217,79,79,0.4)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[14px] font-medium text-ink flex flex-wrap items-center gap-2">
                      {r.risk}
                      <span className="font-mono text-[10px] text-ink-muted font-normal">
                        sev {r.severity}/5 · prob {r.likelihood}/5
                      </span>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                      <span className="text-ink-secondary">Mitigant —</span> {r.mitigant}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </motion.section>

        {/* ── evidence trail ───────────────────────────────────────── */}
        <motion.section {...rise()} className="mt-14">
          <p className="microlabel mb-5">evidence trail</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {findings.map((f, i) => (
              <motion.div
                key={i}
                {...rise(0.03 * i)}
                className="glass rounded-xl px-4 py-3 flex gap-3 items-start"
              >
                <span className="mt-1.5">
                  <SentimentDot sentiment={f.sentiment} size={6} />
                </span>
                <div>
                  <p className="microlabel mb-1">{f.facet}</p>
                  <p className="text-[12.5px] leading-relaxed text-ink-secondary">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
          {sources.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass rounded-full px-3 py-1.5 font-mono text-[10.5px] text-ink-muted hover:text-ink hover:border-white/20 transition-colors"
                >
                  {s.domain ?? s.title.slice(0, 40)}
                </a>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── footer ───────────────────────────────────────────────── */}
        <motion.footer {...rise()} className="mt-16 pt-10 border-t border-white/[0.06] flex flex-col items-center gap-7 text-center">
          <Signature />
          <p className="max-w-xl text-[11.5px] leading-relaxed text-ink-muted">
            Prepared by the InvestIQ analyst collective — six AI agents that identify,
            investigate, debate, and stress-test before deciding. This memo is AI-generated
            research for educational purposes, not investment advice.
          </p>
          <button
            onClick={onNew}
            className="rounded-full px-6 py-3 text-[13.5px] font-medium cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(120deg, #b8842f, #e3b862)", color: "#0c0a05" }}
          >
            Research another company
          </button>
        </motion.footer>
      </div>
    </motion.main>
  );
}

function HeroMeta({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="microlabel mb-1">{label}</p>
      <p className="text-[14px] font-medium" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function CaseColumn({
  side,
  summary,
  points,
}: {
  side: "bull" | "bear";
  summary: string;
  points: { title: string; detail: string }[];
}) {
  const color = side === "bull" ? "var(--bull-bright)" : "var(--bear-bright)";
  return (
    <motion.section
      {...rise(side === "bear" ? 0.1 : 0)}
      className="glass rounded-3xl p-8 relative overflow-hidden"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }}
      />
      <div className="flex items-center gap-2.5 mb-2">
        <span style={{ color }} className="text-[15px]">
          {side === "bull" ? "▲" : "▼"}
        </span>
        <h3 className="text-[15px] font-medium" style={{ color }}>
          The {side} case
        </h3>
      </div>
      <p className="serif-display italic text-[14.5px] leading-relaxed text-ink-secondary mb-6">
        {summary}
      </p>
      <div className="flex flex-col gap-5">
        {points.map((p, i) => (
          <div key={i}>
            <p className="text-[13.5px] font-medium text-ink mb-1">{p.title}</p>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">{p.detail}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
