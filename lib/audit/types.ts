export interface Finding {
  type: "pass" | "warning" | "fail" | "info";
  message: string;
  detail?: string;
  page?: string;
}

export interface DimensionResult {
  id: string;
  name: string;
  weight: number;
  score: number;
  grade: string;
  findings: Finding[];
  fixable: boolean;
}

export interface PageData {
  url: string;
  path: string;
  html: string;
  title: string;
  statusCode?: number;
}

export interface AuditResult {
  url: string;
  timestamp: string;
  siteType: string;
  pagesAudited: number;
  totalPages: number;
  overallScore: number;
  grade: string;
  dimensions: DimensionResult[];
  priorities: string[];
  downloadId: string;
}

export interface AuditProgress {
  type: "progress";
  dimension: string;
  status: "running" | "complete" | "skipped";
  score?: number;
}

export interface AuditComplete {
  type: "complete";
  result: AuditResult;
}

export type AuditStreamMessage = AuditProgress | AuditComplete;

export interface GeneratedFiles {
  "robots.txt"?: string;
  "sitemap.xml"?: string;
  "llms.txt"?: string;
  "llms-full.txt"?: string;
  [key: string]: string | undefined;
}

export interface CrawlResult {
  pages: PageData[];
  robotsTxt: string | null;
  sitemapXml: string | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  siteType: string;
  baseUrl: string;
}
