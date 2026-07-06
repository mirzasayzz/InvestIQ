// ── InvestIQ shared types ──────────────────────────────────────────────
// The event protocol streamed from the research agent to the client,
// plus the shapes of the structured artifacts it produces along the way.

export type PhaseId =
  | "resolve"
  | "plan"
  | "research"
  | "debate"
  | "risk"
  | "verdict";

export type AgentId =
  | "orchestrator"
  | "scout"
  | "analyst"
  | "bull"
  | "bear"
  | "risk"
  | "cio";

export interface CompanyProfile {
  name: string;
  ticker: string | null;
  exchange: string | null;
  sector: string;
  oneLiner: string;
  founded: string | null;
  headquarters: string | null;
  isPublic: boolean;
}

export interface Finding {
  facet: string;
  text: string;
  sentiment: "bull" | "bear" | "neutral";
}

export interface CasePoint {
  title: string;
  detail: string;
}

export interface DebateCase {
  stance: "bull" | "bear";
  points: CasePoint[];
  conviction: number; // 0-100
  summary: string;
}

export interface RiskItem {
  risk: string;
  severity: number; // 1-5
  likelihood: number; // 1-5
  mitigant: string;
}

export interface FactorScore {
  factor: string;
  score: number; // 0-100
  note: string;
}

export interface Verdict {
  decision: "INVEST" | "PASS" | "WATCH";
  conviction: number; // 0-100
  horizon: string;
  thesis: string;
  factors: FactorScore[];
  wouldChangeMind: string[];
  headline: string;
}

export interface SourceRef {
  title: string;
  url?: string;
  domain?: string;
}

export interface Report {
  profile: CompanyProfile;
  plan: string[];
  findings: Finding[];
  bull: DebateCase;
  bear: DebateCase;
  risks: RiskItem[];
  verdict: Verdict;
  sources: SourceRef[];
  generatedAt: string;
  demo?: boolean;
}

// ── Stream events ──────────────────────────────────────────────────────

export type ResearchEvent =
  | { type: "phase"; phase: PhaseId }
  | { type: "thought"; agent: AgentId; text: string }
  | { type: "action"; agent: AgentId; kind: "search" | "read" | "analyze" | "synthesize"; text: string }
  | { type: "source"; source: SourceRef }
  | { type: "profile"; data: CompanyProfile }
  | { type: "plan"; data: string[] }
  | { type: "finding"; data: Finding }
  | { type: "case"; data: DebateCase }
  | { type: "risks"; data: RiskItem[] }
  | { type: "report"; data: Report }
  | { type: "done" }
  | { type: "error"; message: string };

export type EmitFn = (event: ResearchEvent) => void;
