import type { DimensionResult, Finding, PageData } from "../types";
import { parseHTML } from "../parsers";

export function checkRendering(pages: PageData[]): DimensionResult {
  const findings: Finding[] = [];
  let totalScore = 0;

  for (const page of pages) {
    const info = parseHTML(page.html, page.url);
    let pageScore = 0;

    // Check if body has meaningful text content
    if (info.bodyTextLength > 500) {
      pageScore += 40;
      findings.push({
        type: "pass",
        message: `Rich text content (${info.bodyTextLength} chars)`,
        page: page.path,
      });
    } else if (info.bodyTextLength > 100) {
      pageScore += 25;
      findings.push({
        type: "warning",
        message: `Limited text content (${info.bodyTextLength} chars)`,
        page: page.path,
      });
    } else {
      findings.push({
        type: "fail",
        message: `Very little text in HTML source (${info.bodyTextLength} chars)`,
        page: page.path,
        detail: "Content may be rendered by JavaScript and invisible to AI crawlers",
      });
    }

    // Check for SPA mount points
    const isSPA = /<div id="(root|app|__next)">\s*<\/div>/i.test(page.html);
    if (isSPA && info.bodyTextLength < 200) {
      findings.push({
        type: "fail",
        message: "SPA detected with minimal pre-rendered content",
        page: page.path,
        detail: "Consider SSR/SSG for AI crawler visibility",
      });
      pageScore = Math.min(pageScore, 20);
    }

    // Check for SSR/SSG indicators
    const hasSSR = /data-reactroot|__NEXT_DATA__|__NUXT|astro/i.test(page.html);
    if (hasSSR) {
      pageScore += 30;
      findings.push({
        type: "pass",
        message: "SSR/SSG framework detected (content pre-rendered)",
        page: page.path,
      });
    }

    // Check for noscript content
    const hasNoscript = /<noscript>[\s\S]{20,}<\/noscript>/i.test(page.html);
    if (hasNoscript) {
      pageScore += 10;
      findings.push({
        type: "pass",
        message: "Noscript fallback content present",
        page: page.path,
      });
    }

    // Check heading presence in source
    if (info.headings.length > 0) {
      pageScore += 20;
    }

    totalScore += Math.min(100, Math.max(0, pageScore));
  }

  const score = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  return {
    id: "rendering",
    name: "Rendering",
    weight: 0.05,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: false,
  };
}
