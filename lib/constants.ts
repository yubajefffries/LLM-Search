export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Google-Extended",
  "Gemini-Deep-Research",
  "PerplexityBot",
  "Applebot-Extended",
  "Amazonbot",
  "Bingbot",
  "DuckAssistBot",
  "YouBot",
  "meta-externalagent",
  "PhindBot",
  "cohere-ai",
  "ExaBot",
] as const;

export const DIMENSION_WEIGHTS = {
  schema: 0.25,
  robots: 0.20,
  llmsTxt: 0.15,
  aeo: 0.15,
  meta: 0.10,
  sitemap: 0.05,
  semantic: 0.05,
  rendering: 0.05,
} as const;

export const DIMENSION_INFO = [
  { id: "schema", name: "Schema.org JSON-LD", weight: 0.25, fixable: true },
  { id: "robots", name: "robots.txt", weight: 0.20, fixable: true },
  { id: "llmsTxt", name: "llms.txt", weight: 0.15, fixable: true },
  { id: "aeo", name: "AEO Content Quality", weight: 0.15, fixable: false },
  { id: "meta", name: "Meta & OG Tags", weight: 0.10, fixable: true },
  { id: "sitemap", name: "sitemap.xml", weight: 0.05, fixable: true },
  { id: "semantic", name: "Semantic HTML", weight: 0.05, fixable: false },
  { id: "rendering", name: "Rendering", weight: 0.05, fixable: false },
] as const;

export const GRADE_THRESHOLDS = [
  { min: 90, grade: "A", label: "Excellent" },
  { min: 80, grade: "B", label: "Good" },
  { min: 70, grade: "C", label: "Average" },
  { min: 60, grade: "D", label: "Below Average" },
  { min: 0, grade: "F", label: "Poor" },
] as const;

export const REQUIRED_META_TAGS = [
  "title",
  "description",
  "canonical",
  "og:title",
  "og:description",
  "og:url",
  "og:type",
  "og:image",
] as const;

export const MAX_PAGES_TO_AUDIT = 20;
export const MAX_PAGES_TO_DISCOVER = 50;
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const STORE_TTL_MS = 60 * 60 * 1000; // 1 hour
