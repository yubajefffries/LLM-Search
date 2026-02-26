import { NextRequest } from "next/server";
import { parseUploadedZip } from "@/lib/audit/crawler";
import { runFullAudit } from "@/lib/audit/scorer";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Zip magic bytes: PK\x03\x04
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export async function POST(request: NextRequest) {
  // Rate limiting (same pool as URL audits)
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

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: "No file provided", message: "Please upload a .zip file." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return new Response(
      JSON.stringify({
        error: "File too large",
        message: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum is 10 MB.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (file.size === 0) {
    return new Response(
      JSON.stringify({ error: "Empty file", message: "The uploaded file is empty." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Read file buffer and validate zip magic bytes
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer.slice(0, 4));
  const isZip = ZIP_MAGIC.every((byte, i) => header[i] === byte);

  if (!isZip) {
    return new Response(
      JSON.stringify({
        error: "Invalid file type",
        message: "Only .zip files are accepted. The uploaded file does not appear to be a valid zip archive.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream response via NDJSON (same format as URL audit)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(dimension: string, status: string, score?: number, detail?: string) {
        const line = JSON.stringify({ type: "progress", dimension, status, score, detail }) + "\n";
        controller.enqueue(encoder.encode(line));
      }

      try {
        // Parse zip
        sendProgress("Extracting files", "running");
        const crawl = await parseUploadedZip(buffer);
        sendProgress("Extracting files", "complete");

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
