"use client";

// ── Brand marks: the clickable wordmark and the maker's signature ─────

import { motion } from "motion/react";

export function Sigil({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="url(#sigil-g)"
        strokeWidth="1.5"
      />
      <path
        d="M7.5 14.5l3-3.5 2.5 2 3.5-4.5"
        stroke="url(#sigil-g)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sigil-g" x1="3" y1="3" x2="21" y2="21">
          <stop stopColor="#e3b862" />
          <stop offset="1" stopColor="#b8842f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The InvestIQ wordmark — always a way home. */
export function Brand({ onHome }: { onHome?: () => void }) {
  return (
    <button
      onClick={onHome}
      className="group flex items-center gap-2.5 cursor-pointer select-none"
      aria-label="InvestIQ — back to start"
      title="Back to start"
    >
      <span className="transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110">
        <Sigil />
      </span>
      <span className="text-[15px] tracking-tight font-medium">
        Invest
        <span
          className="transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(227,184,98,0.6)]"
          style={{ color: "var(--gold-bright)" }}
        >
          IQ
        </span>
      </span>
    </button>
  );
}

/**
 * The maker's mark — a memo sign-off. The signature underline draws
 * itself on hover and the GitHub glyph steps out of the ink.
 */
export function Signature({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="https://github.com/mirzasayzz"
      target="_blank"
      rel="noreferrer"
      className="group inline-flex flex-col items-center gap-1 no-underline"
      aria-label="Made by Tuba Mirza — GitHub"
    >
      {!compact && (
        <span className="microlabel transition-colors duration-300 group-hover:text-ink-secondary">
          prepared under the direction of
        </span>
      )}
      <span className="relative inline-flex items-center gap-2">
        {compact && (
          <span className="microlabel transition-colors duration-300 group-hover:text-ink-secondary">
            crafted by
          </span>
        )}
        <span
          className={`serif-display italic leading-none transition-all duration-300 group-hover:gold-glow ${
            compact ? "text-[15px]" : "text-[26px]"
          }`}
          style={{ color: "var(--gold-bright)" }}
        >
          Tuba&nbsp;Mirza
        </span>
        {/* github glyph slides out of the signature */}
        <span
          className={`inline-flex items-center overflow-hidden transition-all duration-500 ease-out w-0 opacity-0 group-hover:opacity-100 ${
            compact ? "group-hover:w-[15px]" : "group-hover:w-[18px]"
          }`}
        >
          <svg
            className="shrink-0 -translate-x-2 group-hover:translate-x-0 transition-transform duration-500"
            width={compact ? 13 : 16}
            height={compact ? 13 : 16}
            viewBox="0 0 24 24"
            fill="var(--gold-bright)"
            aria-hidden
          >
            <path d="M12 1.5A10.5 10.5 0 001.5 12c0 4.64 3.01 8.58 7.18 9.97.53.1.72-.23.72-.5v-1.78c-2.92.64-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.54-1.17-1.54-.95-.65.07-.64.07-.64 1.06.07 1.61 1.08 1.61 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.2 0-1.14.41-2.08 1.08-2.81-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.07a10 10 0 015.25 0c2-1.35 2.88-1.07 2.88-1.07.57 1.45.21 2.52.1 2.79.67.73 1.08 1.67 1.08 2.81 0 4.04-2.46 4.93-4.8 5.19.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0012 1.5z" />
          </svg>
        </span>
      </span>
      {/* self-drawing underline */}
      {!compact && (
        <SignatureStroke />
      )}
    </a>
  );
}

function SignatureStroke() {
  return (
    <svg
      width="150"
      height="10"
      viewBox="0 0 150 10"
      fill="none"
      className="mt-0.5"
      aria-hidden
    >
      <motion.path
        d="M4 6.5 C 34 2.5, 60 8.5, 88 5 S 136 3.5, 146 5.5"
        stroke="url(#sig-stroke)"
        strokeWidth="1.3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <defs>
        <linearGradient id="sig-stroke" x1="0" y1="0" x2="150" y2="0">
          <stop stopColor="#b8842f" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#e3b862" />
          <stop offset="1" stopColor="#b8842f" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  );
}
