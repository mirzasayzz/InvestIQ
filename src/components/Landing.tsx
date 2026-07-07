"use client";

// ── Act I: the landing ─────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Brand, Signature } from "./Brand";

const SUGGESTIONS = [
  "NVIDIA",
  "Zomato",
  "Stripe",
  "WeWork",
  "Beyond Meat",
  "Reliance Industries",
];

const ROTATING = ["conviction", "evidence", "debate", "judgment"];
const LONGEST_ROTATING = ROTATING.reduce((a, b) =>
  b.length > a.length ? b : a
);

const SURPRISE_POOL = [
  "NVIDIA",
  "Tesla",
  "Zomato",
  "Stripe",
  "Airbnb",
  "Palantir",
  "Shopify",
  "SpaceX",
  "Netflix",
  "Adani Green Energy",
  "Duolingo",
  "Ferrari",
  "ASML",
  "Swiggy",
  "OpenAI",
  "Nintendo",
  "WeWork",
  "Beyond Meat",
  "Peloton",
  "Byju's",
  "Nikola",
  "Vodafone Idea",
];

export function Landing({ onSubmit }: { onSubmit: (company: string) => void }) {
  const [value, setValue] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <motion.main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* wordmark */}
      <motion.header
        className="fixed top-0 inset-x-0 flex items-center justify-between px-8 py-6"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <Brand
          onHome={() => {
            setValue("");
            inputRef.current?.focus();
          }}
        />
        <span className="microlabel hidden sm:block">ai investment research desk</span>
      </motion.header>

      <div className="w-full max-w-3xl flex flex-col items-center text-center">
        <motion.p
          className="microlabel mb-7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          six analysts · one verdict
        </motion.p>

        <h1 className="text-[clamp(2.4rem,6vw,4.1rem)] leading-[1.06] tracking-tight font-light">
          <StaggerWords text="Every great investment" delay={0.15} />
          <br />
          <StaggerWords text="begins with" delay={0.5} />{" "}
          {/* grid-stacked slot: an invisible sizer (the longest word) fixes the
              cell size, so the rotating word never reflows the layout below */}
          <span className="relative inline-grid align-baseline text-left">
            <span
              aria-hidden
              className="serif-display italic invisible whitespace-nowrap col-start-1 row-start-1"
            >
              {LONGEST_ROTATING}.
            </span>
            <motion.em
              key={ROTATING[wordIdx]}
              className="serif-display italic gold-glow whitespace-nowrap col-start-1 row-start-1"
              style={{ color: "var(--gold-bright)" }}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              {ROTATING[wordIdx]}.
            </motion.em>
          </span>
        </h1>

        <motion.p
          className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-secondary"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
        >
          Name a company. A team of AI analysts will investigate it, argue both
          sides, weigh the risks — and hand you a decision.
        </motion.p>

        {/* command bar */}
        <motion.div
          className="mt-11 w-full max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="glass-strong rounded-2xl flex items-center gap-3 pl-5 pr-2 py-2 transition-shadow duration-500 focus-within:shadow-[0_0_0_1px_rgba(227,184,98,0.35),0_8px_40px_-8px_rgba(227,184,98,0.18)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-50">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
              <path d="M20 20l-3.4-3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Name a company — e.g. NVIDIA, Zomato, Stripe…"
              className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-ink-muted py-2.5"
              autoFocus
              spellCheck={false}
              aria-label="Company name"
            />
            <kbd className="hidden sm:block text-[10px] font-mono text-ink-muted border border-white/10 rounded-md px-1.5 py-0.5">
              /
            </kbd>
            <button
              onClick={submit}
              disabled={!value.trim()}
              className="rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: value.trim()
                  ? "linear-gradient(120deg, #b8842f, #e3b862)"
                  : "rgba(255,255,255,0.06)",
                color: value.trim() ? "#0c0a05" : "var(--ink-secondary)",
              }}
            >
              Investigate
            </button>
          </div>

          {/* suggestions */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="microlabel mr-1">try</span>
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                onClick={() => onSubmit(s)}
                className="glass rounded-full px-3.5 py-1.5 text-[12.5px] text-ink-secondary hover:text-ink hover:border-white/20 transition-all duration-300 cursor-pointer hover:-translate-y-px"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.25 + i * 0.07, duration: 0.5 }}
              >
                {s}
              </motion.button>
            ))}
            <motion.button
              onClick={() =>
                onSubmit(
                  SURPRISE_POOL[Math.floor(Math.random() * SURPRISE_POOL.length)]
                )
              }
              className="rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-300 cursor-pointer hover:-translate-y-px flex items-center gap-1.5"
              style={{
                border: "1px solid rgba(227,184,98,0.35)",
                color: "var(--gold-bright)",
                background: "var(--gold-soft)",
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25 + SUGGESTIONS.length * 0.07, duration: 0.5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l1.9 5.6L20 10l-6.1 1.4L12 17l-1.9-5.6L4 10l6.1-1.4L12 3z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              Surprise me
            </motion.button>
          </div>
        </motion.div>
      </div>

      <motion.footer
        className="fixed bottom-0 inset-x-0 flex items-center justify-center pb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.7, duration: 1 }}
      >
        <div className="flex items-center gap-3">
          <p className="microlabel">research, not investment advice</p>
          <span className="microlabel opacity-40">·</span>
          <Signature compact />
        </div>
      </motion.footer>
    </motion.main>
  );
}

function StaggerWords({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: delay + i * 0.09,
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
          {" "}
        </motion.span>
      ))}
    </>
  );
}

// Sigil now lives in ./Brand — re-exported for compatibility.
export { Sigil } from "./Brand";
