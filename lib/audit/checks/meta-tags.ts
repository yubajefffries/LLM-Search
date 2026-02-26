import type { DimensionResult, Finding, PageData } from "../types";
import { parseHTML } from "../parsers";

const REQUIRED_TAGS = [
  { key: "title", label: "Title tag" },
  { key: "metaDescription", label: "Meta description" },
  { key: "canonical", label: "Canonical link" },
  { key: "ogTitle", label: "og:title" },
  { key: "ogDescription", label: "og:description" },
  { key: "ogUrl", label: "og:url" },
  { key: "ogType", label: "og:type" },
  { key: "ogImage", label: "og:image" },
] as const;

export function checkMetaTags(pages: PageData[]): DimensionResult {
  const findings: Finding[] = [];
  let totalScore = 0;

  for (const page of pages) {
    const info = parseHTML(page.html, page.url);
    let pageScore = 0;
    const missing: string[] = [];
    const present: string[] = [];

    for (const tag of REQUIRED_TAGS) {
      const value = info[tag.key as keyof typeof info];
      if (value && typeof value === "string" && value.trim().length > 0) {
        present.push(tag.label);
        pageScore += 12.5; // 100 / 8 tags
      } else {
        missing.push(tag.label);
      }
    }

    // Extra checks
    if (info.metaDescription) {
      if (info.metaDescription.length < 50) {
        findings.push({
          type: "warning",
          message: `Meta description too short (${info.metaDescription.length} chars)`,
          page: page.path,
        });
        pageScore -= 5;
      } else if (info.metaDescription.length > 160) {
        findings.push({
          type: "warning",
          message: `Meta description too long (${info.metaDescription.length} chars)`,
          page: page.path,
        });
        pageScore -= 3;
      }
    }

    if (info.title && (info.title === "Untitled" || info.title.length < 5)) {
      findings.push({
        type: "warning",
        message: `Generic or short title: "${info.title}"`,
        page: page.path,
      });
      pageScore -= 5;
    }

    if (missing.length === 0) {
      findings.push({
        type: "pass",
        message: `All 8 meta tags present`,
        page: page.path,
      });
    } else {
      findings.push({
        type: missing.length > 4 ? "fail" : "warning",
        message: `Missing: ${missing.join(", ")}`,
        page: page.path,
      });
    }

    totalScore += Math.min(100, Math.max(0, Math.round(pageScore)));
  }

  const score = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  return {
    id: "meta",
    name: "Meta & OG Tags",
    weight: 0.10,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: true,
  };
}
