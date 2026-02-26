import * as cheerio from "cheerio";
import JSZip from "jszip";
import type { CrawlResult, PageData } from "./types";
import { extractInternalLinks, detectSiteType } from "./parsers";
import { MAX_PAGES_TO_DISCOVER } from "../constants";

// SSRF protection: block private/internal IPs
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[::1\]$/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80/i,
];

function isBlockedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return BLOCKED_HOSTS.some(pattern => pattern.test(url.hostname));
  } catch {
    return true;
  }
}

async function fetchPage(url: string): Promise<{ html: string; status: number } | null> {
  if (isBlockedUrl(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LLMSearch-Audit/1.0 (+https://llmsearch.yourupdatedpage.xyz)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) return { html: "", status: response.status };

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await response.text();
    return { html, status: response.status };
  } catch {
    return null;
  }
}

async function fetchTextFile(url: string): Promise<string | null> {
  if (isBlockedUrl(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LLMSearch-Audit/1.0 (+https://llmsearch.yourupdatedpage.xyz)",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function crawlSite(inputUrl: string): Promise<CrawlResult> {
  // Normalize URL
  let baseUrl = inputUrl.trim();
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = "https://" + baseUrl;
  }
  // Remove trailing slash
  if (baseUrl.endsWith("/") && baseUrl !== "https://" && baseUrl !== "http://") {
    baseUrl = baseUrl.slice(0, -1);
  }

  const parsedBase = new URL(baseUrl);
  const origin = parsedBase.origin;

  // Fetch root page
  const rootResult = await fetchPage(baseUrl);
  if (!rootResult || !rootResult.html) {
    throw new Error(`Could not fetch ${baseUrl} — site may be unreachable`);
  }

  const pages: PageData[] = [];
  const visited = new Set<string>();

  // Process root page
  const $ = cheerio.load(rootResult.html);
  const title = $("title").first().text().trim() || baseUrl;
  pages.push({
    url: baseUrl,
    path: "/",
    html: rootResult.html,
    title,
    statusCode: rootResult.status,
  });
  visited.add(baseUrl);

  // Discover internal links
  const discoveredLinks = extractInternalLinks($, baseUrl);
  const toVisit = discoveredLinks.filter(l => !visited.has(l)).slice(0, MAX_PAGES_TO_DISCOVER);

  // Crawl discovered pages (with concurrency limit)
  const CONCURRENCY = 5;
  for (let i = 0; i < toVisit.length; i += CONCURRENCY) {
    const batch = toVisit.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => {
        if (visited.has(url)) return null;
        visited.add(url);
        const result = await fetchPage(url);
        if (!result || !result.html) return null;

        const $page = cheerio.load(result.html);
        const pageTitle = $page("title").first().text().trim() || url;
        const path = new URL(url).pathname;

        return {
          url,
          path,
          html: result.html,
          title: pageTitle,
          statusCode: result.status,
        } as PageData;
      })
    );

    for (const r of results) {
      if (r) pages.push(r);
    }

    // Brief pause between batches
    if (i + CONCURRENCY < toVisit.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Fetch special files
  const [robotsTxt, sitemapXml, llmsTxt, llmsFullTxt] = await Promise.all([
    fetchTextFile(`${origin}/robots.txt`),
    fetchTextFile(`${origin}/sitemap.xml`),
    fetchTextFile(`${origin}/llms.txt`),
    fetchTextFile(`${origin}/llms-full.txt`),
  ]);

  const siteType = detectSiteType(pages);

  return {
    pages,
    robotsTxt,
    sitemapXml,
    llmsTxt,
    llmsFullTxt,
    siteType,
    baseUrl: origin,
  };
}

/**
 * Placeholder origin used for uploaded sites so all code that calls
 * `new URL(baseUrl)` keeps working without special-casing.
 */
const UPLOAD_ORIGIN = "https://uploaded.local";

/**
 * Parse an uploaded zip file into a CrawlResult.
 * Extracts HTML files and special config files (robots.txt, sitemap.xml, llms.txt).
 */
export async function parseUploadedZip(buffer: ArrayBuffer): Promise<CrawlResult> {
  const zip = await JSZip.loadAsync(buffer);

  const pages: PageData[] = [];
  let robotsTxt: string | null = null;
  let sitemapXml: string | null = null;
  let llmsTxt: string | null = null;
  let llmsFullTxt: string | null = null;

  const entries = Object.entries(zip.files);

  for (const [path, entry] of entries) {
    if (entry.dir) continue;

    // Normalize: strip leading folder if the zip has a single root folder
    const normalizedPath = path.replace(/^[^/]+\//, (match) => {
      // Check if there's a common root folder containing everything
      const hasRoot = entries.every(
        ([p]) => p.startsWith(match) || p === match.slice(0, -1)
      );
      return hasRoot ? "" : match;
    });

    const fileName = normalizedPath.split("/").pop()?.toLowerCase() ?? "";
    const isRoot = !normalizedPath.includes("/") || normalizedPath.split("/").length <= 2;

    // Detect special files at the zip root (or one level deep)
    if (isRoot && fileName === "robots.txt") {
      robotsTxt = await entry.async("string");
      continue;
    }
    if (isRoot && fileName === "sitemap.xml") {
      sitemapXml = await entry.async("string");
      continue;
    }
    if (isRoot && fileName === "llms.txt") {
      llmsTxt = await entry.async("string");
      continue;
    }
    if (isRoot && fileName === "llms-full.txt") {
      llmsFullTxt = await entry.async("string");
      continue;
    }

    // Process HTML files
    if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
      const html = await entry.async("string");
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim() || fileName;
      const pagePath = "/" + (normalizedPath || fileName);

      pages.push({
        url: `${UPLOAD_ORIGIN}${pagePath}`,
        path: pagePath,
        html,
        title,
      });
    }
  }

  if (pages.length === 0) {
    throw new Error("No HTML files found in the zip archive.");
  }

  const siteType = detectSiteType(pages);

  return {
    pages,
    robotsTxt,
    sitemapXml,
    llmsTxt,
    llmsFullTxt,
    siteType,
    baseUrl: UPLOAD_ORIGIN,
  };
}
