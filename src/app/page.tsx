"use client";

// ── InvestIQ — three acts: Landing → Theater → Report ─────────────────

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useResearch } from "@/lib/useResearch";
import { Landing } from "@/components/Landing";
import { Theater } from "@/components/Theater";
import { ReportView } from "@/components/Report";

type Act = "landing" | "theater" | "reveal" | "report";

export default function Home() {
  const { session, start, reset } = useResearch();
  const [act, setAct] = useState<Act>("landing");

  // When the report lands, hold the theater a beat, play the reveal,
  // then hand over to the memo. Depends only on the report itself —
  // if `act` were a dependency, the first transition would re-run the
  // cleanup and cancel the second timer.
  useEffect(() => {
    if (!session.report) return;
    const t1 = setTimeout(
      () => setAct((a) => (a === "theater" ? "reveal" : a)),
      900
    );
    const t2 = setTimeout(
      () => setAct((a) => (a === "theater" || a === "reveal" ? "report" : a)),
      3300
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [session.report]);

  const begin = (company: string) => {
    start(company);
    setAct("theater");
  };

  const backHome = () => {
    reset();
    setAct("landing");
  };

  return (
    <>
      <div className="stage" aria-hidden />
      <div className="grain" aria-hidden />

      <AnimatePresence mode="wait">
        {act === "landing" && <Landing key="landing" onSubmit={begin} />}

        {act === "theater" && (
          <Theater key="theater" session={session} onAbort={backHome} />
        )}

        {act === "reveal" && (
          <VerdictReveal
            key="reveal"
            decision={session.report?.verdict.decision ?? "WATCH"}
            company={session.report?.profile.name ?? session.company}
          />
        )}

        {act === "report" && session.report && (
          <ReportView key="report" report={session.report} onNew={backHome} />
        )}
      </AnimatePresence>

      {/* error overlay */}
      <AnimatePresence>
        {session.status === "error" && act !== "landing" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-strong rounded-3xl p-10 max-w-md text-center"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="microlabel mb-4">investigation halted</p>
              <p className="text-[15px] leading-relaxed text-ink-secondary">
                {session.error ?? "Something went wrong."}
              </p>
              <button
                onClick={backHome}
                className="mt-8 rounded-full px-6 py-2.5 text-[13px] font-medium cursor-pointer"
                style={{
                  background: "linear-gradient(120deg, #b8842f, #e3b862)",
                  color: "#0c0a05",
                }}
              >
                Start over
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── the reveal — a decision stamp landing on the screen ─────────────── */

function VerdictReveal({
  decision,
  company,
}: {
  decision: "INVEST" | "PASS" | "WATCH";
  company: string;
}) {
  const color =
    decision === "INVEST"
      ? "var(--bull-bright)"
      : decision === "PASS"
        ? "var(--bear-bright)"
        : "var(--gold-bright)";
  const glow =
    decision === "INVEST"
      ? "rgba(67,212,146,0.45)"
      : decision === "PASS"
        ? "rgba(240,122,122,0.45)"
        : "rgba(227,184,98,0.5)";

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.6 }}
    >
      <motion.p
        className="microlabel mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        the committee has decided on {company}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 2.2, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: -4 }}
        transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1.2, 0.4, 1] }}
        className="px-10 py-5 rounded-2xl"
        style={{
          border: `2px solid ${color}`,
          color,
          boxShadow: `0 0 80px -10px ${glow}`,
        }}
      >
        <span className="font-mono text-[clamp(2.4rem,7vw,4rem)] font-bold tracking-[0.18em]">
          {decision}
        </span>
      </motion.div>
      <motion.p
        className="mt-10 text-[13px] text-ink-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
      >
        preparing the memo…
      </motion.p>
    </motion.div>
  );
}
