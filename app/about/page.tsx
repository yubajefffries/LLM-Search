import type { Metadata } from "next";
import { DIMENSION_INFO, GRADE_THRESHOLDS, AI_CRAWLERS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About — LLM Search AI Visibility Audit",
  description:
    "Learn how the LLM Search audit works: 8 dimensions, weighted scoring, and what each check means for your AI search visibility.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-4 text-3xl font-bold text-foreground">
        How the Audit Works
      </h1>
      <p className="mb-8 text-muted-foreground">
        LLM Search analyzes your website across 8 dimensions that determine how
        visible your content is to AI search engines like ChatGPT, Claude,
        Perplexity, Gemini, and others. Each dimension is weighted by its impact
        on AI discoverability.
      </p>

      <h2 className="mb-4 text-xl font-bold text-foreground">
        The 8 Dimensions
      </h2>
      <div className="mb-12 space-y-6">
        {DIMENSION_INFO.map((dim, i) => (
          <div key={dim.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {i + 1}. {dim.name}
              </h3>
              <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent">
                {Math.round(dim.weight * 100)}% weight
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {getDimensionDescription(dim.id)}
            </p>
            {dim.fixable && (
              <p className="mt-2 text-xs text-pass">
                Auto-fix available — generated files included in download
              </p>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-4 text-xl font-bold text-foreground">Grade Scale</h2>
      <div className="mb-12 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Score</th>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Grade</th>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {GRADE_THRESHOLDS.map((t) => (
              <tr key={t.grade} className="border-t border-border">
                <td className="px-4 py-2 text-muted-foreground">
                  {t.min}-{t.grade === "A" ? "100" : GRADE_THRESHOLDS[GRADE_THRESHOLDS.indexOf(t) - 1]?.min ? GRADE_THRESHOLDS[GRADE_THRESHOLDS.indexOf(t) - 1].min - 1 : "100"}
                </td>
                <td className="px-4 py-2 font-bold text-foreground">{t.grade}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-xl font-bold text-foreground">
        AI Crawlers We Check ({AI_CRAWLERS.length})
      </h2>
      <div className="mb-12 flex flex-wrap gap-2">
        {AI_CRAWLERS.map((crawler) => (
          <span
            key={crawler}
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
          >
            {crawler}
          </span>
        ))}
      </div>

      <h2 className="mb-4 text-xl font-bold text-foreground">
        What You Get
      </h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          Detailed score for each of the 8 dimensions with specific findings
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          Top 3 priority actions ranked by impact
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          Downloadable fix files: robots.txt, sitemap.xml, llms.txt, llms-full.txt
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          AI-enhanced content analysis (when available)
        </li>
      </ul>
    </div>
  );
}

function getDimensionDescription(id: string): string {
  const descriptions: Record<string, string> = {
    schema:
      "Checks for Schema.org JSON-LD structured data on each page. Validates that appropriate schema types are present (Organization, WebSite, BreadcrumbList, BlogPosting, etc.) with all required properties populated. This is the #1 signal for AI search engines to understand your content.",
    robots:
      "Verifies your robots.txt explicitly allows all 17+ known AI crawler user-agents including GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and more. Blocked crawlers mean zero AI visibility from those platforms.",
    llmsTxt:
      "Checks for llms.txt and llms-full.txt files following the llmstxt.org specification. These machine-readable site guides help AI systems understand your site structure and content at a glance.",
    aeo:
      "Evaluates Answer Engine Optimization patterns: TL;DR summaries, direct-answer paragraphs, FAQ sections, short paragraph formatting, lists, and citations. Content structured for AI extraction gets cited more often.",
    meta:
      "Audits 8 essential meta tags per page: title, meta description, canonical URL, og:title, og:description, og:url, og:type, and og:image. These provide the baseline context AI systems use when indexing.",
    sitemap:
      "Validates sitemap.xml existence, XML format, page coverage, lastmod dates, and whether robots.txt references it. A complete sitemap helps AI crawlers discover all your pages efficiently.",
    semantic:
      "Checks heading hierarchy (single H1, no skipped levels), semantic HTML landmarks (main, nav, header, footer), image alt text, and proper content structure. Clean HTML is easier for AI to parse.",
    rendering:
      "Detects whether your content is visible in raw HTML source or hidden behind JavaScript. SPA/CSR sites score poorly because AI crawlers typically don't execute JavaScript. SSR/SSG sites score highest.",
  };
  return descriptions[id] || "";
}
