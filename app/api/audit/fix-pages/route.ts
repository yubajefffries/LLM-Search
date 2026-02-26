import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getStoredPages } from "@/lib/audit/store";
import { generateFixedHtmlPages } from "@/lib/audit/generators";
import { z } from "zod";

const requestSchema = z.object({
  fixPagesId: z.string().min(1, "fixPagesId is required"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", message: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const stored = getStoredPages(parsed.data.fixPagesId);
  if (!stored) {
    return NextResponse.json(
      { error: "Session expired or not found. Please run a new audit." },
      { status: 404 },
    );
  }

  const fixedPages = generateFixedHtmlPages(
    stored.pages,
    stored.schemaFiles,
    stored.baseUrl,
    stored.siteName,
  );

  if (Object.keys(fixedPages).length === 0) {
    return NextResponse.json({
      message: "No pages needed fixing — all pages already have the required meta tags and JSON-LD.",
      files: {},
    });
  }

  // Check if client wants ZIP or JSON
  const wantZip = request.headers.get("accept")?.includes("application/zip");

  if (wantZip) {
    const zip = new JSZip();
    for (const [filename, content] of Object.entries(fixedPages)) {
      zip.file(filename, content);
    }
    const buffer = await zip.generateAsync({ type: "uint8array" });
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=fixed-pages.zip",
      },
    });
  }

  // Return as JSON with file listing
  const fileSummary: Record<string, { size: number; changes: string }> = {};
  for (const [filename, content] of Object.entries(fixedPages)) {
    if (filename.endsWith(".html")) {
      // Count tags added by looking at the README
      const readme = fixedPages["pages/README.md"] || "";
      const pageKey = filename.replace("pages/", "").replace(".html", "");
      const changeMatch = readme.match(new RegExp(`\\*\\*/?${pageKey.replace("--", "/")}\\*\\*: (.+)`));
      fileSummary[filename] = {
        size: content.length,
        changes: changeMatch?.[1] || "Tags updated",
      };
    }
  }

  return NextResponse.json({
    files: fixedPages,
    summary: fileSummary,
    pageCount: Object.keys(fixedPages).filter(f => f.endsWith(".html")).length,
  });
}
