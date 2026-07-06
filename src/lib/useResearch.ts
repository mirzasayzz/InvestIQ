"use client";

// ── Client hook: drives one research session over SSE ─────────────────

import { useCallback, useRef, useState } from "react";
import type {
  CompanyProfile,
  DebateCase,
  Finding,
  PhaseId,
  Report,
  ResearchEvent,
  SourceRef,
} from "@/lib/agent/types";

export interface FeedItem {
  id: number;
  event: ResearchEvent;
  at: number;
}

export interface ResearchSession {
  status: "idle" | "running" | "done" | "error";
  company: string;
  phase: PhaseId | null;
  phasesSeen: PhaseId[];
  feed: FeedItem[];
  profile: CompanyProfile | null;
  plan: string[];
  findings: Finding[];
  sources: SourceRef[];
  bull: DebateCase | null;
  bear: DebateCase | null;
  report: Report | null;
  error: string | null;
  startedAt: number | null;
}

const initial: ResearchSession = {
  status: "idle",
  company: "",
  phase: null,
  phasesSeen: [],
  feed: [],
  profile: null,
  plan: [],
  findings: [],
  sources: [],
  bull: null,
  bear: null,
  report: null,
  error: null,
  startedAt: null,
};

export function useResearch() {
  const [session, setSession] = useState<ResearchSession>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSession(initial);
  }, []);

  const start = useCallback(async (company: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSession({
      ...initial,
      status: "running",
      company,
      startedAt: Date.now(),
    });

    const apply = (event: ResearchEvent) => {
      setSession((s) => {
        const next: ResearchSession = { ...s };
        // Feed gets every narratable event.
        if (
          event.type === "thought" ||
          event.type === "action" ||
          event.type === "source" ||
          event.type === "finding"
        ) {
          next.feed = [...s.feed, { id: ++idRef.current, event, at: Date.now() }];
        }
        switch (event.type) {
          case "phase":
            next.phase = event.phase;
            next.phasesSeen = s.phasesSeen.includes(event.phase)
              ? s.phasesSeen
              : [...s.phasesSeen, event.phase];
            break;
          case "profile":
            next.profile = event.data;
            break;
          case "plan":
            next.plan = event.data;
            break;
          case "finding":
            next.findings = [...s.findings, event.data];
            break;
          case "source":
            next.sources = [...s.sources, event.source];
            break;
          case "case":
            if (event.data.stance === "bull") next.bull = event.data;
            else next.bear = event.data;
            break;
          case "report":
            next.report = event.data;
            break;
          case "done":
            next.status = "done";
            break;
          case "error":
            next.status = "error";
            next.error = event.message;
            break;
        }
        return next;
      });
    };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Research request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            apply(JSON.parse(line.slice(6)) as ResearchEvent);
          } catch {
            /* malformed frame — skip */
          }
        }
      }

      // If the stream closed without a terminal event, surface it.
      setSession((s) =>
        s.status === "running"
          ? { ...s, status: "error", error: "The research stream ended unexpectedly. Please try again." }
          : s
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setSession((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong",
      }));
    }
  }, []);

  return { session, start, reset };
}
