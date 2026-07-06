// ── POST /api/research — streams the investigation as SSE ─────────────

import { NextRequest } from "next/server";
import { runResearch } from "@/lib/agent/graph";
import type { ResearchEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let company = "";
  try {
    const body = (await req.json()) as { company?: string };
    company = (body.company ?? "").trim().slice(0, 80);
  } catch {
    /* fall through to validation below */
  }

  if (!company) {
    return Response.json({ error: "company is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: ResearchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Keep proxies from timing out the stream during long model calls.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 12_000);

      runResearch(company, send)
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Research failed unexpectedly";
          send({ type: "error", message });
        })
        .finally(() => {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
