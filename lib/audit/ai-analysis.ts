import Anthropic from "@anthropic-ai/sdk";
import type { AuditResult, DimensionResult, Finding, PageData } from "./types";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

const AI_TIMEOUT_MS = 25_000;

function createClient(): Anthropic {
  return new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 0 });
}

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Log API key status at module load
console.log("[AI] ANTHROPIC_API_KEY:", hasApiKey() ? "configured" : "NOT SET — AI features disabled");
console.log("[AI] Model:", AI_MODEL);

export function checkAeoContent(pages: PageData[]): DimensionResult {
  // This is the deterministic AEO check — basic pattern matching
  const findings: Finding[] = [];
  let totalScore = 0;

  for (const page of pages) {
    let pageScore = 0;
    const html = page.html.toLowerCase();

    // Check for TL;DR / summary blocks
    const hasSummary = /class\s*=\s*["'][^"']*(?:summary|tldr|intro|excerpt)[^"']*["']/i.test(page.html)
      || /id\s*=\s*["'][^"']*(?:summary|tldr)[^"']*["']/i.test(page.html);

    if (hasSummary) {
      pageScore += 20;
      findings.push({ type: "pass", message: "Has summary/TL;DR section", page: page.path });
    } else {
      findings.push({
        type: "warning",
        message: "No TL;DR or summary block found near page top",
        page: page.path,
        detail: "Add a 2-sentence summary after the H1",
      });
    }

    // Check for FAQ sections
    const hasFaq = html.includes("faq") || /<details/i.test(page.html) || /FAQPage/i.test(page.html);
    if (hasFaq) {
      pageScore += 15;
      findings.push({ type: "pass", message: "FAQ section detected", page: page.path });
    }

    // Check paragraph lengths (short = better for AEO)
    const paragraphs = page.html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const paragraphTexts = paragraphs.map(p => p.replace(/<[^>]+>/g, "").trim()).filter(t => t.length > 20);

    if (paragraphTexts.length > 0) {
      const avgWords = paragraphTexts.reduce((acc, p) => acc + p.split(/\s+/).length, 0) / paragraphTexts.length;
      if (avgWords <= 50) {
        pageScore += 20;
        findings.push({ type: "pass", message: `Short paragraphs (avg ${Math.round(avgWords)} words)`, page: page.path });
      } else if (avgWords <= 100) {
        pageScore += 10;
        findings.push({
          type: "warning",
          message: `Medium paragraph length (avg ${Math.round(avgWords)} words)`,
          page: page.path,
          detail: "Break into shorter paragraphs for better AI extraction",
        });
      } else {
        findings.push({
          type: "fail",
          message: `Long paragraphs (avg ${Math.round(avgWords)} words)`,
          page: page.path,
          detail: "Dense text walls reduce AI answer extraction quality",
        });
      }
    }

    // Check for lists
    const listCount = (page.html.match(/<(?:ul|ol)[^>]*>/gi) || []).length;
    if (listCount > 0) {
      pageScore += 15;
      findings.push({ type: "pass", message: `${listCount} lists for scannable content`, page: page.path });
    }

    // Check for direct-answer formatting
    const hasDirectAnswer = hasSummary || (paragraphTexts.length > 0 && paragraphTexts[0].split(/[.!?]/).length <= 3);
    if (hasDirectAnswer) {
      pageScore += 15;
    }

    // Check for citations / references
    const hasCitations = /cite|source|reference|bibliography/i.test(page.html)
      || /<a[^>]*>.*?(?:\[\d+\]|source|citation)/i.test(page.html);
    if (hasCitations) {
      pageScore += 15;
      findings.push({ type: "pass", message: "Citations or references detected", page: page.path });
    }

    totalScore += Math.min(100, Math.max(0, pageScore));
  }

  const score = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  return {
    id: "aeo",
    name: "AEO Content Quality",
    weight: 0.15,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: false,
  };
}

export async function enhanceAeoWithAI(
  basicResult: DimensionResult,
  pages: PageData[]
): Promise<{ result: DimensionResult; aiUsed: boolean; error?: string; durationMs: number }> {
  const start = Date.now();

  if (!hasApiKey()) {
    return { result: basicResult, aiUsed: false, error: "No ANTHROPIC_API_KEY configured", durationMs: Date.now() - start };
  }

  try {
    const client = createClient();

    // Prepare condensed page content for analysis
    const pagesSummary = pages.slice(0, 5).map(p => {
      const textOnly = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return `Page: ${p.path}\nTitle: ${p.title}\nContent (first 1000 chars): ${textOnly.substring(0, 1000)}`;
    }).join("\n\n---\n\n");

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze these web pages for AI/LLM search optimization (AEO - Answer Engine Optimization). Score 0-100 and provide 3-5 specific findings. Be concise.

Consider:
- Does content directly answer likely user questions?
- Are there clear, extractable summary statements?
- Is content structured for AI consumption (short paragraphs, lists, Q&A)?
- Would an AI be able to cite this content confidently?

${pagesSummary}

Respond in JSON only: {"score": number, "findings": [{"type": "pass"|"warning"|"fail", "message": "string"}]}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiResult = JSON.parse(jsonMatch[0]);
      // Blend AI score with deterministic score (60% AI, 40% deterministic)
      const blendedScore = Math.round(aiResult.score * 0.6 + basicResult.score * 0.4);
      return {
        result: {
          ...basicResult,
          score: blendedScore,
          grade: blendedScore >= 90 ? "A" : blendedScore >= 80 ? "B" : blendedScore >= 70 ? "C" : blendedScore >= 60 ? "D" : "F",
          findings: [
            ...basicResult.findings,
            ...((aiResult.findings || []) as Finding[]).map((f: Finding) => ({
              ...f,
              detail: "(AI-analyzed)",
            })),
          ],
        },
        aiUsed: true,
        durationMs: Date.now() - start,
      };
    }

    return { result: basicResult, aiUsed: false, error: "AI returned unparseable response", durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI] enhanceAeoWithAI failed:", msg);
    return { result: basicResult, aiUsed: false, error: msg, durationMs: Date.now() - start };
  }
}

export async function generateLlmsTxtWithAI(
  pages: PageData[],
  baseUrl: string,
  siteName: string
): Promise<{ result: { llmsTxt: string; llmsFullTxt: string } | null; error?: string; durationMs: number }> {
  const start = Date.now();

  if (!hasApiKey()) {
    return { result: null, error: "No ANTHROPIC_API_KEY configured", durationMs: Date.now() - start };
  }

  try {
    const client = createClient();

    const pagesInfo = pages.map(p => {
      const textOnly = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return {
        path: p.path,
        title: p.title,
        url: p.url,
        excerpt: textOnly.substring(0, 300),
        fullText: textOnly.substring(0, 2000),
      };
    });

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Generate llms.txt and llms-full.txt files following the llmstxt.org spec for this site.

Site: ${siteName} (${baseUrl})

Pages:
${pagesInfo.map(p => `- ${p.title} (${p.url}): ${p.excerpt}`).join("\n")}

Format for llms.txt:
# {Site Name}
> {1-2 sentence description}
## {Category}
- [{Title}]({URL}): {description}

For llms-full.txt: same structure but include full page content under each entry.

Respond in JSON: {"llmsTxt": "string", "llmsFullTxt": "string"}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { result: parsed, durationMs: Date.now() - start };
    }

    return { result: null, error: "AI returned unparseable response", durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI] generateLlmsTxtWithAI failed:", msg);
    return { result: null, error: msg, durationMs: Date.now() - start };
  }
}

export async function generateSchemaJsonLdWithAI(
  pages: PageData[],
  baseUrl: string,
  siteName: string
): Promise<{ result: Record<string, string> | null; error?: string; durationMs: number }> {
  const start = Date.now();

  if (!hasApiKey()) {
    return { result: null, error: "No ANTHROPIC_API_KEY configured", durationMs: Date.now() - start };
  }

  try {
    const client = createClient();

    const pagesInfo = pages.slice(0, 10).map(p => {
      const textOnly = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const metaDesc = p.html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]
        || p.html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)?.[1]
        || "";
      return `Page: ${p.path}\nURL: ${p.url}\nTitle: ${p.title}\nMeta description: ${metaDesc}\nContent (first 500 chars): ${textOnly.substring(0, 500)}`;
    }).join("\n\n---\n\n");

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Generate Schema.org JSON-LD structured data for each page of this website. Use the most appropriate schema types for each page.

Site: ${siteName} (${baseUrl})

${pagesInfo}

For each page, generate valid JSON-LD with @context, @type, and relevant properties. Use these guidelines:
- Home page → Organization + WebSite
- Blog posts → BlogPosting with author, datePublished, publisher
- About page → AboutPage
- Services → Service
- FAQ → FAQPage with Question/Answer
- Non-home pages → include BreadcrumbList

Respond in JSON only: {"files": {"page-path.jsonld": "<script type=\\"application/ld+json\\">...JSON-LD...</script>", ...}}

Use safe filenames (replace / with --, remove leading --). Include the full <script> tag wrapper.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { result: parsed.files || null, durationMs: Date.now() - start };
    }

    return { result: null, error: "AI returned unparseable response", durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI] generateSchemaJsonLdWithAI failed:", msg);
    return { result: null, error: msg, durationMs: Date.now() - start };
  }
}

export async function enhanceReportWithAI(
  basicReport: string,
  result: AuditResult,
  siteType: string,
): Promise<{ report: string; aiUsed: boolean; error?: string; durationMs: number }> {
  const start = Date.now();

  if (!hasApiKey()) {
    return { report: basicReport, aiUsed: false, error: "No ANTHROPIC_API_KEY configured", durationMs: Date.now() - start };
  }

  try {
    const client = createClient();

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are an LLM search optimization expert. Enhance this remediation report with richer, more actionable explanations. Keep the same markdown structure and headings. Make the advice more specific to this ${siteType} site that scored ${result.overallScore}/100 (grade ${result.grade}).

Focus on:
- More specific "how to fix" instructions for ${siteType}
- Better explanations of why each dimension matters for AI/LLM discoverability
- Concrete examples where helpful

Keep it professional, concise, and actionable. Return ONLY the enhanced markdown report (no wrapping, no code blocks).

---

${basicReport}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    if (text.length > 100) {
      return { report: text, aiUsed: true, durationMs: Date.now() - start };
    }

    return { report: basicReport, aiUsed: false, error: "AI returned too-short response", durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI] enhanceReportWithAI failed:", msg);
    return { report: basicReport, aiUsed: false, error: msg, durationMs: Date.now() - start };
  }
}
