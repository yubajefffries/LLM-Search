import * as cheerio from "cheerio";
import type { PageData } from "./types";

export function parseHTML(html: string, url: string): ReturnType<typeof extractPageInfo> & { $: cheerio.CheerioAPI } {
  const $ = cheerio.load(html);
  return { ...extractPageInfo($, url), $ };
}

export function extractPageInfo($: cheerio.CheerioAPI, url: string) {
  return {
    title: $("title").first().text().trim(),
    metaDescription: $('meta[name="description"]').attr("content") || "",
    canonical: $('link[rel="canonical"]').attr("href") || "",
    ogTitle: $('meta[property="og:title"]').attr("content") || "",
    ogDescription: $('meta[property="og:description"]').attr("content") || "",
    ogUrl: $('meta[property="og:url"]').attr("content") || "",
    ogType: $('meta[property="og:type"]').attr("content") || "",
    ogImage: $('meta[property="og:image"]').attr("content") || "",
    h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
    headings: extractHeadingHierarchy($),
    jsonLd: extractJsonLd($),
    links: extractInternalLinks($, url),
    hasMain: $("main").length > 0,
    hasNav: $("nav").length > 0,
    hasHeader: $("header").length > 0,
    hasFooter: $("footer").length > 0,
    hasArticle: $("article").length > 0,
    hasSection: $("section").length > 0,
    imgsWithoutAlt: $("img:not([alt])").length,
    totalImgs: $("img").length,
    bodyTextLength: $("body").text().replace(/\s+/g, " ").trim().length,
    bodyText: $("body").text().replace(/\s+/g, " ").trim().substring(0, 5000),
    hasFaqSection: $('[class*="faq"], [id*="faq"], details, [itemtype*="FAQPage"]').length > 0,
    paragraphs: $("p").map((_, el) => $(el).text().trim()).get().filter(t => t.length > 0),
    lists: $("ul, ol").length,
    hasBlockquote: $("blockquote").length > 0,
    hasSummaryClass: $('[class*="summary"], [class*="tldr"], [class*="intro"], [class*="excerpt"], [id*="summary"], [id*="tldr"]').length > 0,
  };
}

export function extractHeadingHierarchy($: cheerio.CheerioAPI): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = ((el as unknown as { tagName?: string }).tagName ?? "").toLowerCase();
    const level = parseInt(tag.replace("h", ""), 10);
    if (!isNaN(level)) {
      headings.push({ level, text: $(el).text().trim() });
    }
  });
  return headings;
}

export function extractJsonLd($: cheerio.CheerioAPI): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      }
    } catch {
      // Invalid JSON-LD — will be flagged in check
    }
  });
  return results;
}

export function extractInternalLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: Set<string> = new Set();
  const base = new URL(baseUrl);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === base.hostname) {
        // Normalize: remove hash, trailing slash
        resolved.hash = "";
        let path = resolved.pathname;
        if (path !== "/" && path.endsWith("/")) {
          path = path.slice(0, -1);
        }
        resolved.pathname = path;
        links.add(resolved.href);
      }
    } catch {
      // Skip invalid URLs
    }
  });

  return Array.from(links);
}

export function detectSiteType(pages: PageData[]): string {
  const allHtml = pages.map(p => p.html).join(" ");

  if (/wp-content|wp-includes|wp-json/i.test(allHtml)) return "WordPress";
  if (/_next\//i.test(allHtml)) return "Next.js";
  if (/_nuxt\//i.test(allHtml)) return "Nuxt";
  if (/astro/i.test(allHtml) && /<astro-island/i.test(allHtml)) return "Astro";
  if (/<div id="(root|app)">\s*<\/div>/i.test(allHtml)) return "SPA";
  if (/<div id="__gatsby"/i.test(allHtml)) return "Gatsby";

  return "Static HTML";
}

export function extractTextContent($: cheerio.CheerioAPI): string {
  // Remove script and style tags
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}
