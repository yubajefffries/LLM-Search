import type { DimensionResult, Finding } from "../types";
import { AI_CRAWLERS } from "../../constants";

interface RobotsRule {
  userAgent: string;
  rules: { type: "allow" | "disallow"; path: string }[];
}

function parseRobotsTxt(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let currentAgent: string | null = null;
  let currentRules: { type: "allow" | "disallow"; path: string }[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#") || line === "") continue;

    const uaMatch = line.match(/^User-agent:\s*(.+)/i);
    if (uaMatch) {
      if (currentAgent !== null) {
        rules.push({ userAgent: currentAgent, rules: currentRules });
      }
      currentAgent = uaMatch[1].trim();
      currentRules = [];
      continue;
    }

    const allowMatch = line.match(/^Allow:\s*(.*)/i);
    if (allowMatch && currentAgent !== null) {
      currentRules.push({ type: "allow", path: allowMatch[1].trim() });
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*(.*)/i);
    if (disallowMatch && currentAgent !== null) {
      const path = disallowMatch[1].trim();
      if (path) {
        currentRules.push({ type: "disallow", path });
      }
      continue;
    }
  }

  if (currentAgent !== null) {
    rules.push({ userAgent: currentAgent, rules: currentRules });
  }

  return rules;
}

function isCrawlerBlocked(rules: RobotsRule[], crawlerName: string): boolean {
  // Check specific crawler rules first
  const specificRule = rules.find(
    r => r.userAgent.toLowerCase() === crawlerName.toLowerCase()
  );
  if (specificRule) {
    const hasDisallowAll = specificRule.rules.some(
      r => r.type === "disallow" && r.path === "/"
    );
    const hasAllowAll = specificRule.rules.some(
      r => r.type === "allow" && r.path === "/"
    );
    if (hasDisallowAll && !hasAllowAll) return true;
    if (hasAllowAll) return false;
  }

  // Check wildcard rules
  const wildcardRule = rules.find(r => r.userAgent === "*");
  if (wildcardRule) {
    const hasDisallowAll = wildcardRule.rules.some(
      r => r.type === "disallow" && r.path === "/"
    );
    if (hasDisallowAll) return true;
  }

  return false;
}

export function checkRobots(
  robotsTxt: string | null,
  siteUrl: string
): DimensionResult {
  const findings: Finding[] = [];

  if (!robotsTxt) {
    findings.push({
      type: "fail",
      message: "No robots.txt found",
      detail: "Create a robots.txt file that explicitly allows AI crawlers",
    });
    return {
      id: "robots",
      name: "robots.txt",
      weight: 0.20,
      score: 0,
      grade: "F",
      findings,
      fixable: true,
    };
  }

  findings.push({ type: "pass", message: "robots.txt exists" });

  const rules = parseRobotsTxt(robotsTxt);
  let score = 40; // Base for having the file

  // Check sitemap directive
  const hasSitemap = /^Sitemap:\s*.+/im.test(robotsTxt);
  if (hasSitemap) {
    score += 10;
    findings.push({ type: "pass", message: "Sitemap directive present" });
  } else {
    findings.push({
      type: "warning",
      message: "No Sitemap directive in robots.txt",
    });
  }

  // Check each AI crawler
  const allowedCrawlers: string[] = [];
  const blockedCrawlers: string[] = [];
  const missingCrawlers: string[] = [];

  for (const crawler of AI_CRAWLERS) {
    const hasSpecificRule = rules.some(
      r => r.userAgent.toLowerCase() === crawler.toLowerCase()
    );
    const isBlocked = isCrawlerBlocked(rules, crawler);

    if (isBlocked) {
      blockedCrawlers.push(crawler);
    } else if (hasSpecificRule) {
      allowedCrawlers.push(crawler);
    } else {
      missingCrawlers.push(crawler);
    }
  }

  if (blockedCrawlers.length > 0) {
    findings.push({
      type: "fail",
      message: `${blockedCrawlers.length} AI crawlers blocked`,
      detail: blockedCrawlers.join(", "),
    });
    score -= blockedCrawlers.length * 3;
  }

  if (allowedCrawlers.length > 0) {
    findings.push({
      type: "pass",
      message: `${allowedCrawlers.length} AI crawlers explicitly allowed`,
      detail: allowedCrawlers.join(", "),
    });
    score += Math.min(50, allowedCrawlers.length * 3);
  }

  if (missingCrawlers.length > 0 && missingCrawlers.length < AI_CRAWLERS.length) {
    findings.push({
      type: "warning",
      message: `${missingCrawlers.length} AI crawlers not explicitly listed`,
      detail: missingCrawlers.join(", "),
    });
  }

  score = Math.min(100, Math.max(0, score));

  return {
    id: "robots",
    name: "robots.txt",
    weight: 0.20,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    findings,
    fixable: true,
  };
}
