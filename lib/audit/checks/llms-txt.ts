import type { DimensionResult, Finding, PageData } from "../types";

export function checkLlmsTxt(
  llmsTxt: string | null,
  llmsFullTxt: string | null,
  pages: PageData[]
): DimensionResult {
  const findings: Finding[] = [];

  if (!llmsTxt) {
    findings.push({
      type: "fail",
      message: "No llms.txt found",
      detail: "Create an llms.txt file following the llmstxt.org spec",
    });
    return {
      id: "llmsTxt",
      name: "llms.txt",
      weight: 0.15,
      score: 0,
      grade: "F",
      findings,
      fixable: true,
    };
  }

  findings.push({ type: "pass", message: "llms.txt exists" });
  let score = 30; // Base for existing

  // Check format: H1 at top
  const hasH1 = /^# .+/m.test(llmsTxt);
  if (hasH1) {
    score += 10;
    findings.push({ type: "pass", message: "Has H1 title" });
  } else {
    findings.push({ type: "warning", message: "Missing H1 title at top" });
  }

  // Check for blockquote summary
  const hasBlockquote = /^> .+/m.test(llmsTxt);
  if (hasBlockquote) {
    score += 10;
    findings.push({ type: "pass", message: "Has summary blockquote" });
  } else {
    findings.push({ type: "warning", message: "Missing summary blockquote after H1" });
  }

  // Check for H2 sections
  const h2Sections = llmsTxt.match(/^## .+/gm) || [];
  if (h2Sections.length > 0) {
    score += 10;
    findings.push({ type: "pass", message: `Has ${h2Sections.length} sections` });
  } else {
    findings.push({ type: "warning", message: "No H2 sections found" });
  }

  // Check for link format
  const links = llmsTxt.match(/^- \[.+\]\(.+\)/gm) || [];
  if (links.length > 0) {
    score += 10;
    findings.push({ type: "pass", message: `${links.length} linked entries` });
  } else {
    findings.push({ type: "warning", message: "No links in expected format" });
  }

  // Check page coverage
  const linkedUrls = links.map(l => {
    const match = l.match(/\]\((.+?)\)/);
    return match ? match[1] : "";
  }).filter(Boolean);

  const coveredPages = pages.filter(p =>
    linkedUrls.some(url => p.url.includes(url) || url.includes(p.path))
  );

  if (pages.length > 0) {
    const coverage = coveredPages.length / pages.length;
    if (coverage >= 0.8) {
      score += 15;
      findings.push({ type: "pass", message: `Good page coverage: ${coveredPages.length}/${pages.length}` });
    } else if (coverage >= 0.5) {
      score += 8;
      findings.push({
        type: "warning",
        message: `Partial page coverage: ${coveredPages.length}/${pages.length}`,
      });
    } else {
      findings.push({
        type: "fail",
        message: `Low page coverage: ${coveredPages.length}/${pages.length}`,
      });
    }
  }

  // Check llms-full.txt
  if (llmsFullTxt) {
    score += 15;
    findings.push({ type: "pass", message: "llms-full.txt exists" });
  } else {
    findings.push({ type: "warning", message: "No llms-full.txt found" });
  }

  score = Math.min(100, Math.max(0, score));

  return {
    id: "llmsTxt",
    name: "llms.txt",
    weight: 0.15,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: true,
  };
}
