"use client";

// ── Act II: the research theater ───────────────────────────────────────
// Watching a team of analysts work: a phase rail, a live investigation
// feed, and a dossier that fills in as evidence lands.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { FeedItem, ResearchSession } from "@/lib/useResearch";
import type { AgentId, PhaseId } from "@/lib/agent/types";
import { BalanceMeter, SentimentDot } from "./viz";
import { Brand } from "./Brand";

const PHASES: { id: PhaseId; label: string; hint: string }[] = [
  { id: "resolve", label: "Identify", hint: "Confirming the target" },
  { id: "plan", label: "Frame", hint: "Drafting the key questions" },
  { id: "research", label: "Investigate", hint: "Gathering evidence" },
  { id: "debate", label: "Debate", hint: "Bull vs. bear" },
  { id: "risk", label: "Stress-test", hint: "Weighing the risks" },
  { id: "verdict", label: "Decide", hint: "Writing the memo" },
];

const AGENTS: Record<AgentId, { name: string; color: string }> = {
  orchestrator: { name: "Lead", color: "var(--gold-bright)" },
  scout: { name: "Scout", color: "var(--info)" },
  analyst: { name: "Analyst", color: "var(--info)" },
  bull: { name: "Bull desk", color: "var(--bull-bright)" },
  bear: { name: "Bear desk", color: "var(--bear-bright)" },
  risk: { name: "Risk officer", color: "var(--bear-bright)" },
  cio: { name: "CIO", color: "var(--gold-bright)" },
};

export function Theater({
  session,
  onAbort,
}: {
  session: ResearchSession;
  onAbort: () => void;
}) {
  const { profile, phase, phasesSeen, feed, plan, sources, findings } = session;

  const bullSignal = findings.filter((f) => f.sentiment === "bull").length;
  const bearSignal = findings.filter((f) => f.sentiment === "bear").length;

  return (
    <motion.main
      className="min-h-screen flex flex-col px-4 sm:px-6 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* header */}
      <header className="flex items-center justify-between py-5">
        <Brand onHome={onAbort} />
        <div className="flex items-center gap-3">
          <motion.div
            className="glass rounded-full px-4 py-1.5 flex items-center gap-2.5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--gold-bright)" }} />
            <span className="text-[13px] text-ink-secondary">
              Investigating{" "}
              <span className="text-ink font-medium">
                {profile?.name ?? session.company}
              </span>
            </span>
            {profile?.ticker && (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--gold-soft)", color: "var(--gold-bright)" }}>
                {profile.ticker}
              </span>
            )}
          </motion.div>
          <Elapsed startedAt={session.startedAt} />
          <button
            onClick={onAbort}
            className="text-[12px] text-ink-muted hover:text-ink transition-colors cursor-pointer px-2 py-1"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* stage */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_290px] gap-4 min-h-0">
        {/* phase rail */}
        <aside className="glass rounded-2xl p-5 hidden lg:flex flex-col">
          <p className="microlabel mb-6">investigation</p>
          <div className="flex flex-col gap-0 relative">
            {PHASES.map((p, i) => {
              const state = phase === p.id
                ? "active"
                : phasesSeen.includes(p.id)
                  ? "done"
                  : "pending";
              return (
                <div key={p.id} className="flex gap-3.5 relative">
                  {/* connector */}
                  {i < PHASES.length - 1 && (
                    <span
                      className="absolute left-[9px] top-6 w-px h-[calc(100%-14px)] transition-colors duration-700"
                      style={{
                        background:
                          state === "done" ? "rgba(227,184,98,0.4)" : "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}
                  <span className="relative z-10 mt-0.5">
                    {state === "done" ? (
                      <motion.span
                        className="flex items-center justify-center w-[19px] h-[19px] rounded-full"
                        style={{ background: "var(--gold-soft)", border: "1px solid rgba(227,184,98,0.5)" }}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                      >
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5.5l2.5 2.5L8.5 2.5" stroke="var(--gold-bright)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.span>
                    ) : state === "active" ? (
                      <span className="flex items-center justify-center w-[19px] h-[19px] rounded-full" style={{ border: "1px solid rgba(227,184,98,0.6)" }}>
                        <span className="w-[7px] h-[7px] rounded-full pulse-dot" style={{ background: "var(--gold-bright)" }} />
                      </span>
                    ) : (
                      <span className="block w-[19px] h-[19px] rounded-full" style={{ border: "1px solid rgba(255,255,255,0.12)" }} />
                    )}
                  </span>
                  <div className="pb-7">
                    <p
                      className="text-[13.5px] font-medium transition-colors duration-500"
                      style={{
                        color:
                          state === "active"
                            ? "var(--ink)"
                            : state === "done"
                              ? "var(--ink-secondary)"
                              : "var(--ink-muted)",
                      }}
                    >
                      {p.label}
                    </p>
                    <AnimatePresence>
                      {state === "active" && (
                        <motion.p
                          className="text-[11.5px] text-ink-muted mt-0.5"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {p.hint}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-6 border-t border-white/[0.06]">
            <BalanceMeter bull={bullSignal} bear={bearSignal} compact />
          </div>
        </aside>

        {/* live feed */}
        <Feed feed={feed} running={session.status === "running"} />

        {/* dossier */}
        <aside className="hidden lg:flex flex-col gap-4 min-h-0">
          <AnimatePresence>
            {profile && (
              <motion.div
                className="glass rounded-2xl p-5"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="microlabel mb-3">dossier</p>
                <h3 className="text-[17px] font-medium tracking-tight">{profile.name}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
                  {profile.oneLiner}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <DossierFact label="sector" value={profile.sector} />
                  <DossierFact label="listed" value={profile.ticker ? `${profile.ticker}${profile.exchange ? ` · ${profile.exchange}` : ""}` : "Private"} />
                  {profile.founded && <DossierFact label="founded" value={profile.founded} />}
                  {profile.headquarters && <DossierFact label="hq" value={profile.headquarters} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {plan.length > 0 && (
            <motion.div
              className="glass rounded-2xl p-5 min-h-0 overflow-y-auto"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <p className="microlabel mb-3.5">open questions</p>
              <ol className="flex flex-col gap-3">
                {plan.map((q, i) => (
                  <motion.li
                    key={i}
                    className="flex gap-2.5 text-[12px] leading-relaxed text-ink-secondary"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12 }}
                  >
                    <span className="font-mono text-[10px] mt-0.5 shrink-0" style={{ color: "var(--gold)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q}
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          )}

          <div className="glass rounded-2xl p-5 mt-auto">
            <div className="grid grid-cols-2 gap-3">
              <Tally label="findings" value={findings.length} />
              <Tally label="sources" value={sources.length} />
            </div>
          </div>
        </aside>
      </div>
    </motion.main>
  );
}

/* ── live feed ───────────────────────────────────────────────────────── */

function Feed({ feed, running }: { feed: FeedItem[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [feed.length]);

  return (
    <section
      ref={ref}
      className="glass rounded-2xl overflow-y-auto min-h-[50vh] lg:min-h-0 max-h-[calc(100vh-120px)] px-5 sm:px-7 py-6"
      aria-live="polite"
      aria-label="Live investigation feed"
    >
      <div className="flex flex-col gap-3.5 max-w-2xl mx-auto">
        {feed.map((item) => (
          <FeedRow key={item.id} item={item} />
        ))}
        {running && (
          <motion.div
            className="flex items-center gap-2.5 pl-1 pt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <ThinkingDots />
            <span className="text-[12px] text-ink-muted">analysts working…</span>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const ev = item.event;

  const base = {
    initial: { opacity: 0, y: 14, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  };

  if (ev.type === "thought") {
    const agent = AGENTS[ev.agent];
    return (
      <motion.div {...base} className="pt-3 pb-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: agent.color }} />
          <span className="microlabel" style={{ color: agent.color, opacity: 0.9 }}>
            {agent.name}
          </span>
        </div>
        <p className="serif-display text-[17px] leading-relaxed text-ink/90 italic">
          {ev.text}
        </p>
      </motion.div>
    );
  }

  if (ev.type === "action") {
    const agent = AGENTS[ev.agent];
    return (
      <motion.div {...base} className="flex items-center gap-2.5 pl-1">
        <ActionIcon kind={ev.kind} color={agent.color} />
        <span className="font-mono text-[12px] text-ink-muted">
          <span style={{ color: agent.color, opacity: 0.85 }}>{agent.name.toLowerCase()}</span>
          {" · "}
          {ev.text}
        </span>
      </motion.div>
    );
  }

  if (ev.type === "source") {
    return (
      <motion.a
        {...base}
        href={ev.source.url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-3 glass rounded-xl px-3.5 py-2.5 ml-4 hover:border-white/20 transition-colors"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-md shrink-0" style={{ background: "rgba(125,143,214,0.12)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="var(--info)" strokeWidth="1.5" />
            <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.2 3.8 8.5S14.5 18 12 20.5C9.5 18 8.2 15.3 8.2 12S9.5 5.9 12 3.5z" stroke="var(--info)" strokeWidth="1.2" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] text-ink-secondary group-hover:text-ink truncate transition-colors">
            {ev.source.title}
          </span>
          {ev.source.domain && (
            <span className="block font-mono text-[10.5px] text-ink-muted">{ev.source.domain}</span>
          )}
        </span>
      </motion.a>
    );
  }

  if (ev.type === "finding") {
    const f = ev.data;
    return (
      <motion.div
        {...base}
        className="glass rounded-xl px-4 py-3 ml-4 border-l-2"
        style={{
          borderLeftColor:
            f.sentiment === "bull"
              ? "var(--bull)"
              : f.sentiment === "bear"
                ? "var(--bear)"
                : "rgba(255,255,255,0.2)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <SentimentDot sentiment={f.sentiment} size={5} />
          <span className="microlabel">{f.facet}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">{f.text}</p>
      </motion.div>
    );
  }

  return null;
}

function ActionIcon({ kind, color }: { kind: string; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const };
  return (
    <span className="flex items-center justify-center w-5 h-5 shrink-0 opacity-80">
      {kind === "search" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" {...stroke} />
          <path d="M20 20l-3.4-3.4" {...stroke} />
        </svg>
      ) : kind === "read" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15.5H6.5A2.5 2.5 0 004 21z" {...stroke} strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M18.4 5.6l-2.2 2.2M7.8 16.2l-2.2 2.2" {...stroke} />
        </svg>
      )}
    </span>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full"
          style={{ background: "var(--gold-bright)" }}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/* ── small bits ──────────────────────────────────────────────────────── */

function DossierFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="microlabel mb-0.5">{label}</p>
      <p className="text-[12px] text-ink-secondary leading-snug">{value}</p>
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-[22px] tabular-nums" style={{ color: "var(--gold-bright)" }}>
        {value}
      </p>
      <p className="microlabel mt-0.5">{label}</p>
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = useMemo(
    () => (startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0),
    [now, startedAt]
  );
  return (
    <span className="font-mono text-[12px] text-ink-muted tabular-nums hidden sm:block">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}
