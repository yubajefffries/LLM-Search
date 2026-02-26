import type { DimensionResult, Finding, PageData } from "../types";
import { parseHTML } from "../parsers";

const EXPECTED_SCHEMAS: Record<string, string[]> = {
  home: ["Organization", "WebSite"],
  about: ["Organization", "BreadcrumbList"],
  services: ["Service", "BreadcrumbList"],
  products: ["Product", "BreadcrumbList"],
  blog: ["CollectionPage", "BreadcrumbList"],
  post: ["BlogPosting", "Article", "BreadcrumbList"],
  contact: ["ContactPage", "BreadcrumbList"],
  faq: ["FAQPage", "BreadcrumbList"],
};

function guessPageType(url: string, title: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/" || path === "") return "home";
  if (/about/i.test(path)) return "about";
  if (/service/i.test(path)) return "services";
  if (/product/i.test(path)) return "products";
  if (/blog\/?$/i.test(path)) return "blog";
  if (/blog\/.+|post\/.+|article/i.test(path)) return "post";
  if (/contact/i.test(path)) return "contact";
  if (/faq/i.test(path)) return "faq";
  return "other";
}

function getSchemaTypes(jsonLd: Array<Record<string, unknown>>): string[] {
  return jsonLd.map(item => {
    const type = item["@type"];
    if (Array.isArray(type)) return type as string[];
    if (typeof type === "string") return [type];
    return [];
  }).flat();
}

export function checkSchema(pages: PageData[]): DimensionResult {
  const findings: Finding[] = [];
  let totalScore = 0;
  let pagesWithSchema = 0;

  for (const page of pages) {
    const { jsonLd } = parseHTML(page.html, page.url);
    const types = getSchemaTypes(jsonLd);
    const pageType = guessPageType(page.url, page.title);

    if (jsonLd.length === 0) {
      findings.push({
        type: "fail",
        message: `No JSON-LD found`,
        page: page.path,
      });
      continue;
    }

    pagesWithSchema++;
    let pageScore = 60; // Base score for having JSON-LD

    // Check for invalid JSON-LD
    for (const item of jsonLd) {
      if (!item["@context"] || !item["@type"]) {
        findings.push({
          type: "warning",
          message: `JSON-LD missing @context or @type`,
          page: page.path,
        });
        pageScore -= 10;
      }

      // Check for empty sameAs arrays
      if (Array.isArray(item["sameAs"]) && (item["sameAs"] as unknown[]).length === 0) {
        findings.push({
          type: "warning",
          message: `Empty sameAs array — should contain social URLs or be omitted`,
          page: page.path,
        });
      }

      // Check Organization specifics
      if (item["@type"] === "Organization" && !item["logo"]) {
        findings.push({
          type: "warning",
          message: `Organization schema missing logo`,
          page: page.path,
        });
      }

      // Check BlogPosting specifics
      if (item["@type"] === "BlogPosting" || item["@type"] === "Article") {
        if (!item["author"]) {
          findings.push({ type: "warning", message: `Article missing author`, page: page.path });
        }
        if (!item["datePublished"]) {
          findings.push({ type: "warning", message: `Article missing datePublished`, page: page.path });
        }
      }
    }

    // Check expected types
    const expected = EXPECTED_SCHEMAS[pageType];
    if (expected) {
      const hasExpected = expected.some(e => types.includes(e));
      if (hasExpected) {
        pageScore += 20;
        findings.push({
          type: "pass",
          message: `Has expected schema types: ${types.join(", ")}`,
          page: page.path,
        });
      } else {
        findings.push({
          type: "warning",
          message: `Expected ${expected.join(" or ")} but found: ${types.join(", ") || "none"}`,
          page: page.path,
        });
      }
    }

    // Check BreadcrumbList on non-home pages
    if (pageType !== "home" && !types.includes("BreadcrumbList")) {
      findings.push({
        type: "warning",
        message: `Missing BreadcrumbList schema`,
        page: page.path,
      });
      pageScore -= 5;
    }

    // WebPage is always a plus
    if (types.includes("WebPage")) {
      pageScore += 10;
    }

    totalScore += Math.min(100, Math.max(0, pageScore));
  }

  const score = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  if (pagesWithSchema === 0) {
    findings.unshift({
      type: "fail",
      message: `No JSON-LD structured data found on any page`,
    });
  } else if (pagesWithSchema < pages.length) {
    findings.unshift({
      type: "warning",
      message: `JSON-LD found on ${pagesWithSchema}/${pages.length} pages`,
    });
  } else {
    findings.unshift({
      type: "pass",
      message: `JSON-LD found on all ${pages.length} pages`,
    });
  }

  return {
    id: "schema",
    name: "Schema.org JSON-LD",
    weight: 0.25,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: true,
  };
}
