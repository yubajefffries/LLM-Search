import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getStoredResult } from "@/lib/audit/store";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing download ID" }, { status: 400 });
  }

  const files = getStoredResult(id);
  if (!files) {
    return NextResponse.json(
      { error: "Download expired or not found. Please run a new audit." },
      { status: 404 }
    );
  }

  const zip = new JSZip();

  for (const [filename, content] of Object.entries(files)) {
    if (content) {
      zip.file(filename, content);
    }
  }

  const buffer = await zip.generateAsync({ type: "uint8array" });

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=llm-search-fixes.zip",
    },
  });
}
