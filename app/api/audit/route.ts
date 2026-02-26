import { NextRequest } from "next/server";
import { crawlSite } from "@/lib/audit/crawler";
import { runFullAudit } from "@/lib/audit/scorer";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const auditSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .refine(
      (val) => {
        try {
          const url = new URL(val.startsWith("http") ? val : `https://${val}`);
          return url.hostname.includes(".");
        } catch {
          return false;
        }
      },
      { message: "Please enter a valid URL" }
    ),
});

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limited",
        message: `Too many requests. Try again in ${Math.ceil((rateCheck.resetAt - Date.now()) / 60000)} minutes.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(rateCheck.resetAt).toISOString(),
        },
      }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = auditSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        message: parsed.error.issues[0]?.message || "Invalid input",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream response via NDJSON
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(dimension: string, status: string, score?: number, detail?: string) {
        const line = JSON.stringify({ type: "progress", dimension, status, score, detail }) + "\n";
        controller.enqueue(encoder.encode(line));
      }

      try {
        // Crawl phase
        const crawlHostname = new URL(parsed.data.url.startsWith("http") ? parsed.data.url : `https://${parsed.data.url}`).hostname;
        sendProgress("Crawling site", "running", undefined, `Discovering pages on ${crawlHostname}...`);
        const crawl = await crawlSite(parsed.data.url);
        sendProgress("Crawling site", "complete");
        sendProgress(
          "Site info",
          "complete",
          undefined
        );

        // Send site info
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "info",
              siteType: crawl.siteType,
              pagesFound: crawl.pages.length,
              baseUrl: crawl.baseUrl,
            }) + "\n"
          )
        );

        // Run audit with progress
        const result = await runFullAudit(crawl, (dimension, status, score, detail) => {
          sendProgress(dimension, status, score, detail);
        });

        // Send final result
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "complete", result }) + "\n"
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Audit failed";
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", message }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-RateLimit-Remaining": String(rateCheck.remaining),
    },
  });
}
