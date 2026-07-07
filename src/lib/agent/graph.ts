// ── InvestIQ research agent — LangGraph.js pipeline ────────────────────
// A staged multi-analyst investigation:
//
//   resolve → plan → research (parallel facets) → debate (bull ∥ bear)
//           → risk → verdict
//
// Every node narrates its work through an `emit` callback that the API
// route forwards to the browser as Server-Sent Events, so the UI renders
// the investigation as it unfolds. LLM calls go through the multi-
// provider router in ./llm (automatic fallback + rotation).

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { z } from "zod";
import type {
  CompanyProfile,
  DebateCase,
  EmitFn,
  Finding,
  Report,
  RiskItem,
  SourceRef,
  Verdict,
} from "./types";
import { structuredCall } from "./llm";
import { hasWebSearch, webSearch, type WebResult } from "./search";

// ── Graph state ────────────────────────────────────────────────────────

const ResearchState = Annotation.Root({
  company: Annotation<string>,
  profile: Annotation<CompanyProfile | null>,
  plan: Annotation<string[]>,
  findings: Annotation<Finding[]>,
  sources: Annotation<SourceRef[]>,
  bull: Annotation<DebateCase | null>,
  bear: Annotation<DebateCase | null>,
  risks: Annotation<RiskItem[]>,
  verdict: Annotation<Verdict | null>,
  failed: Annotation<string | null>,
});

type State = typeof ResearchState.State;

type Config = { configurable?: { emit?: EmitFn } };

function getEmit(config: Config): EmitFn {
  return config.configurable?.emit ?? (() => {});
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Score helpers — free models sometimes return numbers as strings.
const score100 = z.coerce.number().transform((n) => Math.min(100, Math.max(0, Math.round(n))));
const score5 = z.coerce.number().transform((n) => Math.min(5, Math.max(1, Math.round(n))));
const softString = z.string().nullish().catch(null);
// Free models sometimes emit booleans as strings ("true"/"false").
const looseBoolean = z.preprocess((v) => {
  if (typeof v === "string") return v.toLowerCase() === "true";
  return v;
}, z.boolean());

// ── Structured output schemas ──────────────────────────────────────────

const profileSchema = z.object({
  known: looseBoolean.describe("Whether this is a real, identifiable company"),
  name: z.string().describe("Canonical company name"),
  ticker: softString.describe("Stock ticker if publicly traded, else null"),
  exchange: softString.describe("Primary listing exchange, else null"),
  sector: z.string().catch("—").describe("Primary sector / industry"),
  oneLiner: z.string().catch("").describe("One crisp sentence describing the business"),
  founded: softString.describe("Founding year, else null"),
  headquarters: softString.describe("HQ city and country, else null"),
  isPublic: looseBoolean.catch(false).describe("Whether the company is publicly traded"),
});

const planSchema = z.object({
  questions: z
    .array(z.string())
    .min(3)
    .describe("4 to 5 sharp research questions an investment committee would ask"),
});

const findingsSchema = z.object({
  findings: z
    .array(
      z.object({
        text: z.string().describe("A specific, evidence-flavored observation"),
        sentiment: z.enum(["bull", "bear", "neutral"]).catch("neutral"),
      })
    )
    .min(1)
    .describe("2 to 3 key findings for this research facet"),
});

const caseSchema = z.object({
  points: z
    .array(
      z.object({
        title: z.string().describe("Short punchy headline for the point"),
        detail: z.string().describe("1-2 sentence supporting argument"),
      })
    )
    .min(2)
    .describe("3 to 4 strongest points for this side of the debate"),
  conviction: score100.describe("How strong this side of the case is, 0-100"),
  summary: z.string().describe("One-sentence summary of this side's case"),
});

const risksSchema = z.object({
  risks: z
    .array(
      z.object({
        risk: z.string().describe("Concise name of the risk"),
        severity: score5.describe("Impact if it materializes, 1-5"),
        likelihood: score5.describe("Probability of materializing, 1-5"),
        mitigant: z.string().catch("None identified").describe("What offsets this risk"),
      })
    )
    .min(2)
    .describe("The 3 to 5 most material risks"),
});

const verdictSchema = z.object({
  decision: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toUpperCase().trim() : v),
      z.enum(["INVEST", "PASS", "WATCH"])
    )
    .describe(
      "INVEST if the risk-adjusted case is compelling, PASS if not, WATCH only when genuinely on the knife's edge"
    ),
  conviction: score100.describe("Confidence in the decision, 0-100"),
  horizon: z.string().catch("3-5 years").describe("Suggested holding horizon, e.g. '3-5 years'"),
  headline: z
    .string()
    .describe("A memorable one-line title for the thesis, like a report cover line"),
  thesis: z
    .string()
    .describe("A 3-5 sentence investment thesis with the core reasoning"),
  factors: z
    .array(
      z.object({
        factor: z.string().describe("One of: Growth, Profitability, Moat, Valuation, Momentum, Management"),
        score: score100.describe("0-100"),
        note: z.string().catch("").describe("A few words justifying the score"),
      })
    )
    .min(4)
    .describe("Score all six factors: Growth, Profitability, Moat, Valuation, Momentum, Management"),
  wouldChangeMind: z
    .array(z.string())
    .min(1)
    .describe("2-3 concrete developments that would flip this decision"),
});

// ── Nodes ──────────────────────────────────────────────────────────────

function fallbackNarrator(emit: EmitFn) {
  return (from: string, to: string, reason: string) => {
    emit({
      type: "action",
      agent: "orchestrator",
      kind: "analyze",
      text: `Model ${from.split("/")[0]} ${reason} — rerouting to ${to.split("/")[0]}`,
    });
  };
}

async function resolveNode(state: State, config: Config) {
  const emit = getEmit(config);
  emit({ type: "phase", phase: "resolve" });
  emit({
    type: "thought",
    agent: "orchestrator",
    text: `Opening a file on “${state.company}” — verifying identity, listing status and sector before committing analyst time.`,
  });

  const result = await structuredCall(
    profileSchema,
    "company_profile",
    `Identify the company "${state.company}" for an investment research desk. If the name is ambiguous, choose the most prominent match. If it is not a real identifiable company, set known=false and leave other fields as best guesses.`,
    { maxTokens: 2000, onFallback: fallbackNarrator(emit) }
  );

  if (!result.known) {
    return {
      failed: `I couldn't identify “${state.company}” as a real company. Try a well-known public or private company name.`,
    };
  }

  const profile: CompanyProfile = {
    name: result.name,
    ticker: result.ticker ?? null,
    exchange: result.exchange ?? null,
    sector: result.sector,
    oneLiner: result.oneLiner,
    founded: result.founded ?? null,
    headquarters: result.headquarters ?? null,
    isPublic: result.isPublic,
  };
  emit({ type: "profile", data: profile });
  emit({
    type: "thought",
    agent: "orchestrator",
    text: `Confirmed: ${profile.name}${profile.ticker ? ` (${profile.ticker})` : ""} — ${profile.sector}. Assembling the analyst team.`,
  });
  return { profile };
}

async function planNode(state: State, config: Config) {
  const emit = getEmit(config);
  const p = state.profile!;
  emit({ type: "phase", phase: "plan" });
  emit({
    type: "thought",
    agent: "orchestrator",
    text: "Framing the investigation. A good verdict starts with the right questions, not the right answers.",
  });

  const result = await structuredCall(
    planSchema,
    "research_plan",
    `You are the head of research at an elite investment firm. Draft the research plan for ${p.name} (${p.sector}) — ${p.oneLiner}. Produce 4-5 sharp questions the team must answer before an invest/pass decision.`,
    { maxTokens: 2000, onFallback: fallbackNarrator(emit) }
  );

  emit({ type: "plan", data: result.questions });
  return { plan: result.questions };
}

const FACETS: {
  facet: string;
  agent: "scout" | "analyst";
  query: (p: CompanyProfile) => string;
}[] = [
  {
    facet: "Business & Moat",
    agent: "analyst",
    query: (p) => `${p.name} business model competitive moat market position`,
  },
  {
    facet: "Financials",
    agent: "analyst",
    query: (p) => `${p.name} revenue growth margins profitability latest earnings`,
  },
  {
    facet: "Market & Competition",
    agent: "scout",
    query: (p) => `${p.name} competitors market share industry outlook`,
  },
  {
    facet: "Catalysts & News",
    agent: "scout",
    query: (p) => `${p.name} recent news catalysts product launches strategy`,
  },
];

async function researchNode(state: State, config: Config) {
  const emit = getEmit(config);
  const p = state.profile!;
  emit({ type: "phase", phase: "research" });
  emit({
    type: "thought",
    agent: "orchestrator",
    text: `Fanning out across four workstreams${hasWebSearch() ? " — scouts are pulling live sources" : ""}. Evidence first, opinions later.`,
  });

  const allFindings: Finding[] = [];
  const allSources: SourceRef[] = [];

  const tasks = FACETS.map(async ({ facet, agent, query }, i) => {
    // Stagger starts so the feed reads like a team dividing work — and so
    // we don't burst-hit provider rate limits.
    await sleep(i * 1200);
    emit({
      type: "action",
      agent,
      kind: "search",
      text: `Investigating ${facet.toLowerCase()} for ${p.name}`,
    });

    let evidence: WebResult[] = [];
    if (hasWebSearch()) {
      evidence = await webSearch(query(p), 3);
      for (const src of evidence) {
        allSources.push({ title: src.title, url: src.url, domain: src.domain });
        emit({
          type: "source",
          source: { title: src.title, url: src.url, domain: src.domain },
        });
        await sleep(200);
      }
    }

    emit({
      type: "action",
      agent,
      kind: "analyze",
      text: `Synthesizing ${facet.toLowerCase()} evidence`,
    });

    const evidenceBlock = evidence.length
      ? `\n\nFresh web evidence:\n${evidence
          .map((e) => `- [${e.title}] ${e.content.slice(0, 500)}`)
          .join("\n")}`
      : "";
    const result = await structuredCall(
      findingsSchema,
      "facet_findings",
      `You are an equity research analyst covering ${p.name} (${p.sector}). Facet: ${facet}. Research questions in play: ${state.plan.join(" | ")}.${evidenceBlock}\n\nProduce 2-3 specific findings for this facet. Each must be concrete (name products, numbers, dynamics — no platitudes) and tagged bull/bear/neutral for the investment case. Do not sanitize: if the evidence contains genuine concerns (stretched valuation, slowing growth, losses, cash burn, competition, regulation, governance, bankruptcy or distress), they MUST appear as bear findings.`,
      { maxTokens: 2000, onFallback: fallbackNarrator(emit) }
    );

    for (const f of result.findings.slice(0, 3)) {
      const finding: Finding = { facet, text: f.text, sentiment: f.sentiment };
      allFindings.push(finding);
      emit({ type: "finding", data: finding });
      await sleep(300);
    }
  });

  await Promise.all(tasks);
  return { findings: allFindings, sources: allSources };
}

async function debateNode(state: State, config: Config) {
  const emit = getEmit(config);
  const p = state.profile!;
  emit({ type: "phase", phase: "debate" });
  emit({
    type: "thought",
    agent: "orchestrator",
    text: "Splitting the room. One analyst argues the strongest possible case for investing; another argues against. Conviction is earned in the crossfire.",
  });

  const findingsBlock = state.findings
    .map((f) => `- (${f.facet} · ${f.sentiment}) ${f.text}`)
    .join("\n");

  const makeCase = async (
    stance: "bull" | "bear",
    delayMs: number
  ): Promise<DebateCase> => {
    await sleep(delayMs);
    emit({
      type: "action",
      agent: stance,
      kind: "synthesize",
      text:
        stance === "bull"
          ? `Building the case FOR investing in ${p.name}`
          : `Stress-testing: the case AGAINST ${p.name}`,
    });
    const result = await structuredCall(
      caseSchema,
      `${stance}_case`,
      `You are the ${stance === "bull" ? "bull-case advocate" : "bear-case advocate (devil's advocate)"} in an investment committee debate about ${p.name} (${p.sector} — ${p.oneLiner}).\n\nTeam findings:\n${findingsBlock}\n\nArgue the ${stance} case as persuasively as the evidence honestly allows. 3-4 points, each with a punchy title and 1-2 sentences of support. Rate your own case's strength (conviction 0-100) honestly — do not inflate a weak case, and do not strawman: if your side of the argument is genuinely the stronger one given the evidence, your conviction should reflect that.`,
      { maxTokens: 2500, onFallback: fallbackNarrator(emit) }
    );
    const dc: DebateCase = { stance, ...result };
    emit({ type: "case", data: dc });
    return dc;
  };

  const [bull, bear] = await Promise.all([
    makeCase("bull", 0),
    makeCase("bear", 1500),
  ]);
  return { bull, bear };
}

async function riskNode(state: State, config: Config) {
  const emit = getEmit(config);
  const p = state.profile!;
  emit({ type: "phase", phase: "risk" });
  emit({
    type: "thought",
    agent: "risk",
    text: "Weighing what could go wrong — sizing each risk by severity and likelihood, and checking what actually mitigates it.",
  });

  const result = await structuredCall(
    risksSchema,
    "risk_register",
    `You are the chief risk officer reviewing a potential position in ${p.name}. Bull case: ${state.bull?.summary}. Bear case: ${state.bear?.summary}.\n\nKey findings:\n${state.findings.map((f) => `- ${f.text}`).join("\n")}\n\nIdentify the 3-5 most material risks. Score severity and likelihood 1-5. Name a real mitigant for each (or state plainly if there is none).`,
    { maxTokens: 2500, onFallback: fallbackNarrator(emit) }
  );

  const risks: RiskItem[] = result.risks.slice(0, 5);
  emit({ type: "risks", data: risks });
  return { risks };
}

async function verdictNode(state: State, config: Config) {
  const emit = getEmit(config);
  const p = state.profile!;
  emit({ type: "phase", phase: "verdict" });
  emit({
    type: "thought",
    agent: "cio",
    text: "The committee has heard both sides. Weighing conviction against risk, and writing the decision memo.",
  });

  // Committee arithmetic — computed from the debate and risk register so
  // the CIO anchors on the pipeline's own evidence, not on brand fame.
  const bullConv = state.bull?.conviction ?? 50;
  const bearConv = state.bear?.conviction ?? 50;
  const netEdge = bullConv - bearConv;
  const worstRisk = state.risks.reduce(
    (m, r) => Math.max(m, r.severity * r.likelihood),
    0
  );
  const bearFindings = state.findings.filter((f) => f.sentiment === "bear").length;

  const result = await structuredCall(
    verdictSchema,
    "investment_verdict",
    `You are the CIO making the final call on ${p.name} (${p.sector}). Your firm's returns come from discipline in BOTH directions: "great company" is NOT the same as "great investment" — fame, size, or past glory earn nothing — but excessive caution also loses; refusing every strong idea is as costly as funding every weak one. Decide purely on the evidence below.\n\nCommittee arithmetic: bull conviction ${bullConv}/100, bear conviction ${bearConv}/100, net edge ${netEdge >= 0 ? "+" : ""}${netEdge}, worst risk score ${worstRisk}/25, bear-tagged findings ${bearFindings} of ${state.findings.length}.\n\nBull case (${bullConv}/100): ${state.bull?.summary}\n${state.bull?.points.map((pt) => `- ${pt.title}: ${pt.detail}`).join("\n")}\n\nBear case (${bearConv}/100): ${state.bear?.summary}\n${state.bear?.points.map((pt) => `- ${pt.title}: ${pt.detail}`).join("\n")}\n\nRisk register:\n${state.risks.map((r) => `- ${r.risk} (severity ${r.severity}/5, likelihood ${r.likelihood}/5, mitigant: ${r.mitigant})`).join("\n")}\n\nDecision rubric — apply it strictly:\n- INVEST: the bull case clearly beats the bear case (meaningful positive net edge), the major risks have credible mitigants, and valuation is defensible. A dominant, profitable business with a durable moat and manageable risks IS an INVEST — do not hide behind PASS to feel safe.\n- PASS: the bear case is comparable or stronger, fundamentals are deteriorating/unproven/distressed, valuation is the core dispute, or a structural risk has no real mitigant.\n- WATCH: only for an excellent business at the wrong price, or an unproven inflection worth monitoring.\nBe decisive — conviction cuts both ways.\n\nWrite like a world-class investor: clear thesis, honest about uncertainty, no hedging filler. Score all six factors 0-100 with honest dispersion — weak factors MUST score low (a distressed company does not score above 50 on Financials-related factors): Growth, Profitability, Moat, Valuation, Momentum, Management.`,
    { maxTokens: 3000, onFallback: fallbackNarrator(emit) }
  );

  // Deterministic guardrail: an INVEST that contradicts the committee's own
  // arithmetic (bear desk at least as convinced as the bull) gets tempered.
  let decision = result.decision;
  if (decision === "INVEST" && netEdge <= 0) {
    decision = "WATCH";
    emit({
      type: "thought",
      agent: "cio",
      text: "The bear desk's conviction matches the bull's — the committee tempers the call to WATCH.",
    });
  }

  const verdict: Verdict = {
    decision,
    conviction: result.conviction,
    horizon: result.horizon,
    headline: result.headline,
    thesis: result.thesis,
    factors: result.factors.slice(0, 6),
    wouldChangeMind: result.wouldChangeMind.slice(0, 3),
  };

  const report: Report = {
    profile: p,
    plan: state.plan,
    findings: state.findings,
    bull: state.bull!,
    bear: state.bear!,
    risks: state.risks,
    verdict,
    sources: state.sources,
    generatedAt: new Date().toISOString(),
  };
  emit({ type: "report", data: report });
  return { verdict };
}

// ── Graph assembly ─────────────────────────────────────────────────────

const graph = new StateGraph(ResearchState)
  .addNode("resolve_step", resolveNode)
  .addNode("plan_step", planNode)
  .addNode("research_step", researchNode)
  .addNode("debate_step", debateNode)
  .addNode("risk_step", riskNode)
  .addNode("verdict_step", verdictNode)
  .addEdge(START, "resolve_step")
  .addConditionalEdges(
    "resolve_step",
    (s: State) => (s.failed ? END : "plan_step"),
    { plan_step: "plan_step", [END]: END }
  )
  .addEdge("plan_step", "research_step")
  .addEdge("research_step", "debate_step")
  .addEdge("debate_step", "risk_step")
  .addEdge("risk_step", "verdict_step")
  .addEdge("verdict_step", END)
  .compile();

// ── Public entrypoint ──────────────────────────────────────────────────

export async function runResearch(company: string, emit: EmitFn): Promise<void> {
  const finalState = await graph.invoke(
    {
      company,
      profile: null,
      plan: [],
      findings: [],
      sources: [],
      bull: null,
      bear: null,
      risks: [],
      verdict: null,
      failed: null,
    },
    { configurable: { emit }, recursionLimit: 25 }
  );

  if (finalState.failed) {
    emit({ type: "error", message: finalState.failed });
  } else {
    emit({ type: "done" });
  }
}
