import type { DimensionResult, Finding, PageData } from "../types";
import { parseHTML } from "../parsers";

export function checkSemantic(pages: PageData[]): DimensionResult {
  const findings: Finding[] = [];
  let totalScore = 0;

  for (const page of pages) {
    const info = parseHTML(page.html, page.url);
    let pageScore = 0;

    // Check single H1
    if (info.h1s.length === 1) {
      pageScore += 25;
      findings.push({ type: "pass", message: "Single H1 tag", page: page.path });
    } else if (info.h1s.length === 0) {
      findings.push({ type: "fail", message: "No H1 tag found", page: page.path });
    } else {
      findings.push({
        type: "warning",
        message: `Multiple H1 tags (${info.h1s.length})`,
        page: page.path,
      });
      pageScore += 10;
    }

    // Check heading hierarchy
    let hierarchyOk = true;
    for (let i = 1; i < info.headings.length; i++) {
      if (info.headings[i].level > info.headings[i - 1].level + 1) {
        hierarchyOk = false;
        findings.push({
          type: "warning",
          message: `Skipped heading level: h${info.headings[i - 1].level} → h${info.headings[i].level}`,
          page: page.path,
        });
        break;
      }
    }
    if (hierarchyOk && info.headings.length > 1) {
      pageScore += 20;
      findings.push({ type: "pass", message: "Correct heading hierarchy", page: page.path });
    }

    // Check semantic elements
    const semanticElements: { name: string; has: boolean }[] = [
      { name: "main", has: info.hasMain },
      { name: "nav", has: info.hasNav },
      { name: "header", has: info.hasHeader },
      { name: "footer", has: info.hasFooter },
    ];

    const presentSemantic = semanticElements.filter(e => e.has);
    const missingSemantic = semanticElements.filter(e => !e.has);

    if (presentSemantic.length === semanticElements.length) {
      pageScore += 30;
      findings.push({ type: "pass", message: "All semantic landmarks present", page: page.path });
    } else if (presentSemantic.length > 0) {
      pageScore += presentSemantic.length * 7;
      findings.push({
        type: "warning",
        message: `Missing semantic elements: ${missingSemantic.map(e => `<${e.name}>`).join(", ")}`,
        page: page.path,
      });
    } else {
      findings.push({ type: "fail", message: "No semantic HTML landmarks found", page: page.path });
    }

    // Check img alt attributes
    if (info.totalImgs > 0) {
      if (info.imgsWithoutAlt === 0) {
        pageScore += 15;
        findings.push({ type: "pass", message: `All ${info.totalImgs} images have alt text`, page: page.path });
      } else {
        findings.push({
          type: "warning",
          message: `${info.imgsWithoutAlt}/${info.totalImgs} images missing alt text`,
          page: page.path,
        });
        pageScore += Math.round(15 * (1 - info.imgsWithoutAlt / info.totalImgs));
      }
    } else {
      pageScore += 15; // No images = no deduction
    }

    // Check for article/section usage
    if (info.hasArticle || info.hasSection) {
      pageScore += 10;
    }

    totalScore += Math.min(100, Math.max(0, pageScore));
  }

  const score = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  return {
    id: "semantic",
    name: "Semantic HTML",
    weight: 0.05,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: false,
  };
}
