// ── Multi-provider LLM router with automatic fallback ─────────────────
// Every structured call walks an ordered chain of OpenAI-compatible
// providers (Gemini → Groq → Cerebras → OpenRouter ×2 → SwiftRouter).
// A candidate that errors, rate-limits, times out, or returns JSON that
// fails schema validation is skipped (with a cooldown for 429s) and the
// next one takes over — so the product keeps working even when free
// tiers throttle.

import { ChatOpenAI } from "@langchain/openai";
import type { z } from "zod";

interface Candidate {
  id: string;
  provider: string;
  baseURL: string;
  apiKeyEnv: string;
  model: string;
  /** seconds to cool down after a 429 from this candidate */
  cooldownSec: number;
  timeoutMs: number;
  /** whether the endpoint supports response_format: json_object */
  jsonMode?: boolean;
}

// Ordered by quality + observed reliability. Only candidates whose env
// key is present are used.
const CANDIDATES: Candidate[] = [
  {
    id: "gemini/gemini-2.5-flash",
    provider: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GEMINI_API_KEY",
    model: "gemini-2.5-flash",
    cooldownSec: 30,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "groq/llama-3.3-70b",
    provider: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
    cooldownSec: 45,
    jsonMode: true,
    timeoutMs: 45_000,
  },
  {
    id: "cerebras/gpt-oss-120b",
    provider: "cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
    cooldownSec: 45,
    jsonMode: true,
    timeoutMs: 45_000,
  },
  {
    id: "groq/gpt-oss-120b",
    provider: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    cooldownSec: 45,
    jsonMode: true,
    timeoutMs: 45_000,
  },
  {
    id: "cerebras/zai-glm-4.7",
    provider: "cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
    model: "zai-glm-4.7",
    cooldownSec: 45,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "openrouter1/llama-3.3-70b",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY_1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    cooldownSec: 90,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "openrouter1/gpt-oss-120b",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY_1",
    model: "openai/gpt-oss-120b:free",
    cooldownSec: 90,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "openrouter2/llama-3.3-70b",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY_2",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    cooldownSec: 90,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "openrouter2/nemotron-super-120b",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY_2",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    cooldownSec: 90,
    jsonMode: true,
    timeoutMs: 60_000,
  },
  {
    id: "swiftrouter/glm-4.7",
    provider: "swiftrouter",
    baseURL: "https://api.swiftrouter.com/v1",
    apiKeyEnv: "SWIFTROUTER_API_KEY",
    model: "glm-4.7",
    cooldownSec: 70,
    timeoutMs: 90_000,
  },
  {
    id: "swiftrouter/command-r",
    provider: "swiftrouter",
    baseURL: "https://api.swiftrouter.com/v1",
    apiKeyEnv: "SWIFTROUTER_API_KEY",
    model: "command-r-08-2024",
    cooldownSec: 70,
    timeoutMs: 60_000,
  },
];

// Module-level cooldown registry: candidate id → epoch-ms until usable.
const coolingUntil = new Map<string, number>();

function availableCandidates(): Candidate[] {
  const now = Date.now();
  return CANDIDATES.filter(
    (c) => process.env[c.apiKeyEnv] && (coolingUntil.get(c.id) ?? 0) <= now
  );
}

function markCooldown(c: Candidate, seconds?: number) {
  coolingUntil.set(c.id, Date.now() + (seconds ?? c.cooldownSec) * 1000);
}

// ── JSON extraction ────────────────────────────────────────────────────

/** Pull the first balanced JSON object out of model text (tolerates
 *  code fences, preambles, and reasoning-model chatter). */
function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // reasoning-model chatter
    .replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("no JSON object in response");
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }
  // Truncated output — attempt a mechanical repair by closing what's open.
  let tail = cleaned.slice(start).trimEnd();
  if (inString) tail += '"';
  tail = tail.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    tail += stack[i] === "{" ? "}" : "]";
  }
  try {
    return JSON.parse(tail);
  } catch {
    throw new Error("unbalanced JSON in response");
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export class AllProvidersFailedError extends Error {
  constructor(public attempts: string[]) {
    super(
      `All LLM providers failed or are rate-limited (tried: ${attempts.join(", ")})`
    );
  }
}

export interface CallOptions {
  maxTokens?: number;
  /** cap on how many providers to try for this call */
  maxAttempts?: number;
  onFallback?: (from: string, to: string, reason: string) => void;
}

/**
 * Ask the router for a structured answer. The zod schema is rendered
 * into the prompt; the response is parsed and validated. Any failure —
 * transport, rate limit, empty content, malformed or invalid JSON —
 * rotates to the next provider.
 */
export async function structuredCall<T extends z.ZodTypeAny>(
  schema: T,
  schemaName: string,
  prompt: string,
  opts: CallOptions = {}
): Promise<z.infer<T>> {
  const { maxTokens = 3000, maxAttempts = 8, onFallback } = opts;
  const attempts: string[] = [];
  let lastError: unknown = null;

  const jsonSpec = schemaToPromptSpec(schema);
  const fullPrompt = `${prompt}

Respond with ONLY a single JSON object matching exactly this shape, with these exact keys at the TOP LEVEL (do not wrap them under any other key; no markdown, no commentary):
${jsonSpec}`;

  let candidates = availableCandidates();
  if (candidates.length === 0) {
    // Everything is cooling down — take the least-recently-cooled anyway.
    candidates = CANDIDATES.filter((c) => process.env[c.apiKeyEnv]);
  }

  for (const candidate of candidates.slice(0, maxAttempts)) {
    attempts.push(candidate.id);
    try {
      const model = new ChatOpenAI({
        model: candidate.model,
        apiKey: process.env[candidate.apiKeyEnv],
        configuration: { baseURL: candidate.baseURL },
        maxTokens,
        timeout: candidate.timeoutMs,
        maxRetries: 0,
        ...(candidate.jsonMode
          ? { modelKwargs: { response_format: { type: "json_object" } } }
          : {}),
      });
      const res = await model.invoke([{ role: "user", content: fullPrompt }]);
      const text =
        typeof res.content === "string"
          ? res.content
          : res.content
              .map((b) => (b.type === "text" ? b.text : ""))
              .join("");
      if (!text.trim()) throw new Error("empty completion");
      return parseWithUnwrap(schema, extractJson(text), schemaName);
    } catch (err) {
      lastError = err;
      const msg = (err instanceof Error ? err.message : String(err)).replace(
        /\s+/g,
        " "
      );
      const is429 = /429|rate.?limit|quota|exceeded/i.test(msg);
      const isAuthOrPlan = /401|403|forbidden|invalid.*key/i.test(msg);
      if (is429) markCooldown(candidate);
      else if (isAuthOrPlan) markCooldown(candidate, 3600);
      else markCooldown(candidate, 10); // transient: brief backoff
      const next = availableCandidates()[0];
      if (next && onFallback) {
        onFallback(candidate.id, next.id, is429 ? "rate limited" : "error");
      }
      console.warn(
        `[llm] ${candidate.id} failed → rotating :: ${msg.slice(0, 300)}`
      );
    }
  }

  throw lastError instanceof Error && attempts.length === 0
    ? lastError
    : new AllProvidersFailedError(attempts);
}

/**
 * Validate model JSON against the schema, tolerating the common failure
 * mode where the model wraps the payload under the schema name or some
 * other single key: `{"investment_verdict": {...}}`.
 */
function parseWithUnwrap<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  schemaName: string
): z.infer<T> {
  const direct = schema.safeParse(raw);
  if (direct.success) return direct.data;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const candidates: unknown[] = [];
    if (obj[schemaName] !== undefined) candidates.push(obj[schemaName]);
    const keys = Object.keys(obj);
    if (keys.length === 1) candidates.push(obj[keys[0]]);
    for (const inner of candidates) {
      const attempt = schema.safeParse(inner);
      if (attempt.success) return attempt.data;
    }
  }
  throw direct.error;
}

// Render a zod object schema into a readable JSON spec for the prompt.
// Works for the flat/nested object+array shapes used in this project.
// (exported for tests)
export function schemaToPromptSpec(schema: z.ZodTypeAny): string {
  return JSON.stringify(zodToSpec(schema), null, 2);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function zodToSpec(schema: any): unknown {
  const def = schema?._def ?? schema?.def;
  const typeName: string = def?.typeName ?? def?.type ?? "";
  const t = String(typeName).toLowerCase();

  // Unwrap pipes (coerce/transform/preprocess): render the side that is a
  // real value schema, not the transform half.
  if (t.includes("pipe")) {
    const sides = [def.in, def.out].filter(Boolean);
    for (const side of sides) {
      const sideType = String(
        side?._def?.typeName ?? side?._def?.type ?? side?.def?.type ?? ""
      ).toLowerCase();
      if (!sideType.includes("transform")) {
        return carryDesc(schema, zodToSpec(side));
      }
    }
    return "value";
  }
  // Unwrap catch/default wrappers.
  if (t.includes("catch") || t.includes("default")) {
    return carryDesc(schema, zodToSpec(def.innerType ?? def.in ?? def.type));
  }

  if (t.includes("object")) {
    const shape =
      typeof def.shape === "function" ? def.shape() : def.shape ?? {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      out[key] = zodToSpec(value);
    }
    return out;
  }
  if (t.includes("array")) {
    const inner = def.element ?? def.type ?? def.innerType;
    return [zodToSpec(inner)];
  }
  if (t.includes("enum")) {
    const values = def.values ?? def.entries;
    const list = Array.isArray(values) ? values : Object.keys(values ?? {});
    return `one of: ${list.join(" | ")}`;
  }
  if (t.includes("nullable") || t.includes("optional")) {
    return `${describeInner(def)} or null`;
  }
  if (t.includes("boolean")) return withDesc(schema, "true or false");
  if (t.includes("number")) return withDesc(schema, "number");
  if (t.includes("string")) return withDesc(schema, "string");
  return "value";
}

function describeInner(def: any): string {
  const inner = def.innerType ?? def.type;
  const spec = zodToSpec(inner);
  return typeof spec === "string" ? spec : JSON.stringify(spec);
}

function withDesc(schema: any, base: string): string {
  const d = schema?.description ?? schema?._def?.description;
  return d ? `${base} — ${d}` : base;
}

// Re-attach an outer wrapper's description to the unwrapped spec.
function carryDesc(schema: any, spec: unknown): unknown {
  const d = schema?.description ?? schema?._def?.description;
  if (d && typeof spec === "string" && !spec.includes(d)) {
    return `${spec} — ${d}`;
  }
  return spec;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
