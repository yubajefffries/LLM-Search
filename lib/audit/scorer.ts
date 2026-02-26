import type { AuditResult, CrawlResult, DimensionResult, GeneratedFiles } from "./types";
import { checkSchema } from "./checks/schema";
import { checkRobots } from "./checks/robots";
import { checkLlmsTxt } from "./checks/llms-txt";
import { checkMetaTags } from "./checks/meta-tags";
import { checkSitemap } from "./checks/sitemap";
import { checkSemantic } from "./checks/semantic";
import { checkRendering } from "./checks/rendering";
import { checkAeoContent, enhanceAeoWithAI, generateLlmsTxtWithAI } from "./ai-analysis";
import { generateRobotsTxt, generateSitemapXml, generateLlmsTxt, generateLlmsFullTxt } from "./generators";
import { DIMENSION_WEIGHTS } from "../constants";
import { getGrade } from "../utils";
import { storeResult } from "./store";
import { MAX_PAGES_TO_AUDIT } from "../constants";

export type ProgressCallback = (dimension: string, status: "running" | "complete" | "skipped", score?: number) => void;

export async function runFullAudit(
  crawl: CrawlResult,
  onProgress?: ProgressCallback
): Promise<AuditResult> {
  const pagesToAudit = crawl.pages.slice(0, MAX_PAGES_TO_AUDIT);
  const siteName = pagesToAudit[0]?.title || new URL(crawl.baseUrl).hostname;

  const dimensions: DimensionResult[] = [];

  // 1. Schema
  onProgress?.("Schema.org JSON-LD", "running");
  const schemaResult = checkSchema(pagesToAudit);
  dimensions.push(schemaResult);
  onProgress?.("Schema.org JSON-LD", "complete", schemaResult.score);

  // 2. robots.txt
  onProgress?.("robots.txt", "running");
  const robotsResult = checkRobots(crawl.robotsTxt, crawl.baseUrl);
  dimensions.push(robotsResult);
  onProgress?.("robots.txt", "complete", robotsResult.score);

  // 3. llms.txt
  onProgress?.("llms.txt", "running");
  const llmsTxtResult = checkLlmsTxt(crawl.llmsTxt, crawl.llmsFullTxt, pagesToAudit);
  dimensions.push(llmsTxtResult);
  onProgress?.("llms.txt", "complete", llmsTxtResult.score);

  // 4. AEO Content
  onProgress?.("AEO Content Quality", "running");
  let aeoResult = checkAeoContent(pagesToAudit);
  try {
    aeoResult = await enhanceAeoWithAI(aeoResult, pagesToAudit);
  } catch {
    // Use deterministic score
  }
  dimensions.push(aeoResult);
  onProgress?.("AEO Content Quality", "complete", aeoResult.score);

  // 5. Meta & OG Tags
  onProgress?.("Meta & OG Tags", "running");
  const metaResult = checkMetaTags(pagesToAudit);
  dimensions.push(metaResult);
  onProgress?.("Meta & OG Tags", "complete", metaResult.score);

  // 6. sitemap.xml
  onProgress?.("sitemap.xml", "running");
  const sitemapResult = checkSitemap(crawl.sitemapXml, crawl.robotsTxt, pagesToAudit);
  dimensions.push(sitemapResult);
  onProgress?.("sitemap.xml", "complete", sitemapResult.score);

  // 7. Semantic HTML
  onProgress?.("Semantic HTML", "running");
  const semanticResult = checkSemantic(pagesToAudit);
  dimensions.push(semanticResult);
  onProgress?.("Semantic HTML", "complete", semanticResult.score);

  // 8. Rendering
  onProgress?.("Rendering", "running");
  const renderingResult = checkRendering(pagesToAudit);
  dimensions.push(renderingResult);
  onProgress?.("Rendering", "complete", renderingResult.score);

  // Calculate overall score
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

  // Generate priority actions
  const priorities = generatePriorities(dimensions);

  // Generate fix files
  const files: GeneratedFiles = {};
  files["robots.txt"] = generateRobotsTxt(crawl.baseUrl);
  files["sitemap.xml"] = generateSitemapXml(crawl.pages, crawl.baseUrl);

  // Try AI-generated llms.txt, fall back to deterministic
  const aiLlms = await generateLlmsTxtWithAI(pagesToAudit, crawl.baseUrl, siteName).catch(() => null);
  if (aiLlms) {
    files["llms.txt"] = aiLlms.llmsTxt;
    files["llms-full.txt"] = aiLlms.llmsFullTxt;
  } else {
    files["llms.txt"] = generateLlmsTxt(crawl.pages, crawl.baseUrl, siteName);
    files["llms-full.txt"] = generateLlmsFullTxt(crawl.pages, crawl.baseUrl, siteName);
  }

  // Store for download
  const downloadId = storeResult(files);

  return {
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
  };
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
