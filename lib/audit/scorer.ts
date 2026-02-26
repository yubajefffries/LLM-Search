import type { AiDiagnostic, AuditResult, CrawlResult, DimensionResult, GeneratedFiles } from "./types";
import { checkSchema } from "./checks/schema";
import { checkRobots } from "./checks/robots";
import { checkLlmsTxt } from "./checks/llms-txt";
import { checkMetaTags } from "./checks/meta-tags";
import { checkSitemap } from "./checks/sitemap";
import { checkSemantic } from "./checks/semantic";
import { checkRendering } from "./checks/rendering";
import { AI_MODEL, checkAeoContent, enhanceAeoWithAI, enhanceReportWithAI, generateLlmsTxtWithAI, generateSchemaJsonLdWithAI, hasApiKey } from "./ai-analysis";
import { generateRobotsTxt, generateSitemapXml, generateLlmsTxt, generateLlmsFullTxt, generateSchemaJsonLd, generateRemediationReport } from "./generators";
import { DIMENSION_WEIGHTS } from "../constants";
import { getGrade } from "../utils";
import { storeResult, storePages } from "./store";
import { MAX_PAGES_TO_AUDIT } from "../constants";

// Per-dimension delays — heavier dimensions take longer to feel real
const STEP_DELAYS: Record<string, number> = {
  "Schema.org JSON-LD": 1200,
  "robots.txt": 900,
  "llms.txt": 800,
  "AEO Content Quality": 800,
  "Meta & OG Tags": 700,
  "sitemap.xml": 500,
  "Semantic HTML": 500,
  "Rendering": 500,
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type ProgressCallback = (dimension: string, status: "running" | "complete" | "skipped", score?: number, detail?: string) => void;

export async function runFullAudit(
  crawl: CrawlResult,
  onProgress?: ProgressCallback
): Promise<AuditResult> {
  const pagesToAudit = crawl.pages.slice(0, MAX_PAGES_TO_AUDIT);
  const siteName = pagesToAudit[0]?.title || new URL(crawl.baseUrl).hostname;

  const dimensions: DimensionResult[] = [];
  const aiDiagnostics: AiDiagnostic[] = [];

  const hostname = new URL(crawl.baseUrl).hostname;
  const pageCount = pagesToAudit.length;

  // 1. Schema (25% weight — split into sub-steps)
  onProgress?.("Schema.org JSON-LD", "running", undefined, `Checking ${pageCount} pages for structured data...`);
  if (onProgress) await delay(Math.floor(STEP_DELAYS["Schema.org JSON-LD"] / 2));
  onProgress?.("Schema.org JSON-LD", "running", undefined, "Analyzing JSON-LD blocks and schema types...");
  if (onProgress) await delay(Math.floor(STEP_DELAYS["Schema.org JSON-LD"] / 2));
  const schemaResult = checkSchema(pagesToAudit);
  dimensions.push(schemaResult);
  onProgress?.("Schema.org JSON-LD", "complete", schemaResult.score);

  // 2. robots.txt (20% weight — split into sub-steps)
  onProgress?.("robots.txt", "running", undefined, `Checking ${hostname}/robots.txt for AI crawler rules...`);
  if (onProgress) await delay(Math.floor(STEP_DELAYS["robots.txt"] / 2));
  onProgress?.("robots.txt", "running", undefined, "Analyzing AI crawler permissions...");
  if (onProgress) await delay(Math.floor(STEP_DELAYS["robots.txt"] / 2));
  const robotsResult = checkRobots(crawl.robotsTxt, crawl.baseUrl);
  dimensions.push(robotsResult);
  onProgress?.("robots.txt", "complete", robotsResult.score);

  // 3. llms.txt (15% weight — split into sub-steps)
  onProgress?.("llms.txt", "running", undefined, "Looking for llms.txt and llms-full.txt...");
  if (onProgress) await delay(Math.floor(STEP_DELAYS["llms.txt"] / 2));
  onProgress?.("llms.txt", "running", undefined, "Validating llmstxt.org format compliance...");
  if (onProgress) await delay(Math.floor(STEP_DELAYS["llms.txt"] / 2));
  const llmsTxtResult = checkLlmsTxt(crawl.llmsTxt, crawl.llmsFullTxt, pagesToAudit);
  dimensions.push(llmsTxtResult);
  onProgress?.("llms.txt", "complete", llmsTxtResult.score);

  // 4. AEO Content (deterministic only — AI enhancement moved to step 9)
  onProgress?.("AEO Content Quality", "running", undefined, "Evaluating content structure for AI extraction...");
  if (onProgress) await delay(STEP_DELAYS["AEO Content Quality"]);
  const aeoResult = checkAeoContent(pagesToAudit);
  dimensions.push(aeoResult);
  onProgress?.("AEO Content Quality", "complete", aeoResult.score);

  // 5. Meta & OG Tags
  onProgress?.("Meta & OG Tags", "running", undefined, "Checking 8 essential meta tags per page...");
  if (onProgress) await delay(STEP_DELAYS["Meta & OG Tags"]);
  const metaResult = checkMetaTags(pagesToAudit);
  dimensions.push(metaResult);
  onProgress?.("Meta & OG Tags", "complete", metaResult.score);

  // 6. sitemap.xml
  onProgress?.("sitemap.xml", "running", undefined, "Validating sitemap for AI crawlers...");
  if (onProgress) await delay(STEP_DELAYS["sitemap.xml"]);
  const sitemapResult = checkSitemap(crawl.sitemapXml, crawl.robotsTxt, pagesToAudit);
  dimensions.push(sitemapResult);
  onProgress?.("sitemap.xml", "complete", sitemapResult.score);

  // 7. Semantic HTML
  onProgress?.("Semantic HTML", "running", undefined, "Analyzing heading hierarchy and landmarks...");
  if (onProgress) await delay(STEP_DELAYS["Semantic HTML"]);
  const semanticResult = checkSemantic(pagesToAudit);
  dimensions.push(semanticResult);
  onProgress?.("Semantic HTML", "complete", semanticResult.score);

  // 8. Rendering
  onProgress?.("Rendering", "running", undefined, "Checking if content is visible without JavaScript...");
  if (onProgress) await delay(STEP_DELAYS["Rendering"]);
  const renderingResult = checkRendering(pagesToAudit);
  dimensions.push(renderingResult);
  onProgress?.("Rendering", "complete", renderingResult.score);

  // 9. AI Analysis — dedicated step for all AI calls
  let aiMode: "ai-enhanced" | "basic" | "ai-failed" = "basic";

  if (hasApiKey()) {
    onProgress?.("AI Analysis", "running", undefined, "Running AI analysis (3 parallel tasks)...");
    let anyAiSucceeded = false;
    let anyAiFailed = false;

    // Fire all 3 independent AI calls in parallel
    const [aeoSettled, llmsSettled, schemaSettled] = await Promise.allSettled([
      enhanceAeoWithAI(aeoResult, pagesToAudit),
      generateLlmsTxtWithAI(pagesToAudit, crawl.baseUrl, siteName),
      generateSchemaJsonLdWithAI(pagesToAudit, crawl.baseUrl, siteName),
    ]);

    // Unwrap — each function already catches internally, so "rejected" = unexpected crash
    const aeoAiResult = aeoSettled.status === "fulfilled"
      ? aeoSettled.value
      : { result: aeoResult, aiUsed: false, error: String(aeoSettled.reason), durationMs: 0 };
    const llmsAiResult = llmsSettled.status === "fulfilled"
      ? llmsSettled.value
      : { result: null, error: String(llmsSettled.reason), durationMs: 0 };
    const schemaAiResult = schemaSettled.status === "fulfilled"
      ? schemaSettled.value
      : { result: null, error: String(schemaSettled.reason), durationMs: 0 };

    // AEO diagnostics
    aiDiagnostics.push({
      step: "AEO Enhancement",
      success: aeoAiResult.aiUsed,
      error: aeoAiResult.error,
      durationMs: aeoAiResult.durationMs,
      model: AI_MODEL,
    });
    if (aeoAiResult.error) anyAiFailed = true;
    if (aeoAiResult.aiUsed) {
      const aeoIndex = dimensions.findIndex(d => d.id === "aeo");
      if (aeoIndex >= 0) dimensions[aeoIndex] = aeoAiResult.result;
      anyAiSucceeded = true;
    }

    // llms.txt diagnostics
    aiDiagnostics.push({
      step: "llms.txt Generation",
      success: !!llmsAiResult.result,
      error: llmsAiResult.error,
      durationMs: llmsAiResult.durationMs,
      model: AI_MODEL,
    });
    if (llmsAiResult.error) anyAiFailed = true;
    if (llmsAiResult.result) anyAiSucceeded = true;

    // Schema JSON-LD diagnostics
    aiDiagnostics.push({
      step: "Schema JSON-LD",
      success: !!schemaAiResult.result,
      error: schemaAiResult.error,
      durationMs: schemaAiResult.durationMs,
      model: AI_MODEL,
    });
    if (schemaAiResult.error) anyAiFailed = true;
    if (schemaAiResult.result) anyAiSucceeded = true;

    aiMode = anyAiSucceeded ? "ai-enhanced" : "ai-failed";
    onProgress?.("AI Analysis", "complete", undefined,
      aiMode === "ai-enhanced" ? "Claude AI analysis complete" : "AI calls failed — using deterministic results"
    );

    // Generate fix files with AI results
    const files: GeneratedFiles = {};
    files["robots.txt"] = generateRobotsTxt(crawl.baseUrl);
    files["sitemap.xml"] = generateSitemapXml(crawl.pages, crawl.baseUrl);

    if (llmsAiResult.result) {
      files["llms.txt"] = llmsAiResult.result.llmsTxt;
      files["llms-full.txt"] = llmsAiResult.result.llmsFullTxt;
    } else {
      files["llms.txt"] = generateLlmsTxt(crawl.pages, crawl.baseUrl, siteName);
      files["llms-full.txt"] = generateLlmsFullTxt(crawl.pages, crawl.baseUrl, siteName);
    }

    // JSON-LD files — prefer AI, fall back to deterministic
    const schemaFiles = schemaAiResult.result || generateSchemaJsonLd(pagesToAudit, crawl.baseUrl, siteName);
    for (const [filename, content] of Object.entries(schemaFiles)) {
      files[filename] = content;
    }

    // Recalculate overall score (AEO may have changed)
    const updatedAeo = dimensions.find(d => d.id === "aeo")!;
    const overallScore = Math.round(
      schemaResult.score * DIMENSION_WEIGHTS.schema +
      robotsResult.score * DIMENSION_WEIGHTS.robots +
      llmsTxtResult.score * DIMENSION_WEIGHTS.llmsTxt +
      updatedAeo.score * DIMENSION_WEIGHTS.aeo +
      metaResult.score * DIMENSION_WEIGHTS.meta +
      sitemapResult.score * DIMENSION_WEIGHTS.sitemap +
      semanticResult.score * DIMENSION_WEIGHTS.semantic +
      renderingResult.score * DIMENSION_WEIGHTS.rendering
    );

    const priorities = generatePriorities(dimensions);
    const downloadId = storeResult(files);

    // Build partial result for report generation
    const partialResult: AuditResult = {
      url: crawl.baseUrl,
      timestamp: new Date().toISOString(),
      siteType: crawl.siteType,
      pagesAudited: pagesToAudit.length,
      totalPages: crawl.pages.length,
      overallScore,
      grade: getGrade(overallScore),
      dimensions,
      priorities,
      downloadId,
      aiMode,
      generatedFiles: files,
      aiDiagnostics,
    };

    // Generate remediation report
    onProgress?.("AI Analysis", "running", undefined, "Generating remediation report...");
    let report = generateRemediationReport(partialResult, pagesToAudit, crawl.baseUrl);

    // Try AI enhancement of report
    if (anyAiSucceeded) {
      const reportAiResult = await enhanceReportWithAI(report, partialResult, crawl.siteType);
      aiDiagnostics.push({
        step: "Report Enhancement",
        success: reportAiResult.aiUsed,
        error: reportAiResult.error,
        durationMs: reportAiResult.durationMs,
        model: AI_MODEL,
      });
      if (reportAiResult.aiUsed) {
        report = reportAiResult.report;
      }
    }
    files["remediation-report.md"] = report;

    // Store pages for on-demand fix generation
    const fixPagesId = storePages(pagesToAudit, schemaFiles, crawl.baseUrl, siteName);

    return {
      ...partialResult,
      generatedFiles: files,
      aiDiagnostics,
      fixPagesId,
    };
  } else {
    // No API key — skip AI step entirely
    onProgress?.("AI Analysis", "skipped", undefined, "No API key configured");

    // Generate fix files (deterministic only)
    const files: GeneratedFiles = {};
    files["robots.txt"] = generateRobotsTxt(crawl.baseUrl);
    files["sitemap.xml"] = generateSitemapXml(crawl.pages, crawl.baseUrl);
    files["llms.txt"] = generateLlmsTxt(crawl.pages, crawl.baseUrl, siteName);
    files["llms-full.txt"] = generateLlmsFullTxt(crawl.pages, crawl.baseUrl, siteName);

    // Deterministic JSON-LD
    const schemaFiles = generateSchemaJsonLd(pagesToAudit, crawl.baseUrl, siteName);
    for (const [filename, content] of Object.entries(schemaFiles)) {
      files[filename] = content;
    }

    const overallScore = Math.round(
      schemaResult.score * DIMENSION_WEIGHTS.schema +
      robotsResult.score * DIMENSION_WEIGHTS.robots +
      llmsTxtResult.score * DIMENSION_WEIGHTS.llmsTxt +
      aeoResult.score * DIMENSION_WEIGHTS.aeo +
      metaResult.score * DIMENSION_WEIGHTS.meta +
      sitemapResult.score * DIMENSION_WEIGHTS.sitemap +
      semanticResult.score * DIMENSION_WEIGHTS.semantic +
      renderingResult.score * DIMENSION_WEIGHTS.rendering
    );

    const priorities = generatePriorities(dimensions);
    const downloadId = storeResult(files);

    const partialResult: AuditResult = {
      url: crawl.baseUrl,
      timestamp: new Date().toISOString(),
      siteType: crawl.siteType,
      pagesAudited: pagesToAudit.length,
      totalPages: crawl.pages.length,
      overallScore,
      grade: getGrade(overallScore),
      dimensions,
      priorities,
      downloadId,
      aiMode,
      generatedFiles: files,
    };

    // Generate remediation report (deterministic only)
    const report = generateRemediationReport(partialResult, pagesToAudit, crawl.baseUrl);
    files["remediation-report.md"] = report;

    // Store pages for on-demand fix generation
    const fixPagesId = storePages(pagesToAudit, schemaFiles, crawl.baseUrl, siteName);

    return {
      ...partialResult,
      generatedFiles: files,
      fixPagesId,
    };
  }
}

function generatePriorities(dimensions: DimensionResult[]): string[] {
  // Sort by weighted impact (low score * high weight = high priority)
  const sorted = [...dimensions].sort((a, b) => {
    const impactA = (100 - a.score) * a.weight;
    const impactB = (100 - b.score) * b.weight;
    return impactB - impactA;
  });

  return sorted.slice(0, 3).map(d => {
    const topFinding = d.findings.find(f => f.type === "fail") || d.findings.find(f => f.type === "warning");
    const action = topFinding?.message || `Improve ${d.name}`;
    return `${d.name} (${d.score}/100): ${action}`;
  });
}
