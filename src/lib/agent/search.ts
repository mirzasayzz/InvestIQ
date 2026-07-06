// ── Optional live web search via Tavily ────────────────────────────────
// If TAVILY_API_KEY is set, the research node grounds itself in fresh
// web results; otherwise the model works from its own knowledge.

import type { SourceRef } from "./types";

export interface WebResult extends SourceRef {
  content: string;
}

export function hasWebSearch(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function webSearch(
  query: string,
  maxResults = 4
): Promise<WebResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { title: string; url: string; content: string }[];
    };
    return (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      domain: safeDomain(r.url),
      content: r.content,
    }));
  } catch {
    return [];
  }
}

function safeDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
