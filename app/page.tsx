"use client";

import { useState, useCallback } from "react";
import { SearchHero } from "@/components/search-hero";
import { AuditProgress } from "@/components/audit-progress";
import { ScoreDisplay } from "@/components/score-display";
import { DimensionCard } from "@/components/dimension-card";
import { GeneratedFilesPanel } from "@/components/generated-files-panel";
import { RemediationReport } from "@/components/remediation-report";
import { FixedPagesPanel } from "@/components/fixed-pages-panel";
import { Button } from "@/components/ui/button";
import { RotateCcw, Shield, FileText, Bot, Globe, Code2, Zap, Search, FileJson } from "lucide-react";
import type { AuditResult } from "@/lib/audit/types";

type AppState = "idle" | "loading" | "results" | "error";

interface ProgressStep {
  dimension: string;
  status: "pending" | "running" | "complete" | "skipped";
  score?: number;
  detail?: string;
}

interface AiSubStep {
  label: string;
  status: "running" | "complete";
}

const DIMENSIONS_EXPLAINED = [
  { icon: FileJson, name: "Schema.org JSON-LD", weight: "25%", desc: "Structured data that helps AI understand your content's meaning and relationships." },
  { icon: Shield, name: "robots.txt", weight: "20%", desc: "Controls which AI crawlers can access your site. 17+ AI bots checked." },
  { icon: FileText, name: "llms.txt", weight: "15%", desc: "A machine-readable site guide following the llmstxt.org standard." },
  { icon: Bot, name: "AEO Content", weight: "15%", desc: "Answer Engine Optimization — is your content formatted for AI extraction?" },
  { icon: Globe, name: "Meta & OG Tags", weight: "10%", desc: "8 essential meta tags that help AI understand each page." },
  { icon: Search, name: "sitemap.xml", weight: "5%", desc: "Helps AI crawlers discover all your pages efficiently." },
  { icon: Code2, name: "Semantic HTML", weight: "5%", desc: "Proper heading hierarchy, landmarks, and accessibility for AI parsing." },
  { icon: Zap, name: "Rendering", weight: "5%", desc: "Is your content visible in raw HTML or hidden behind JavaScript?" },
];

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [siteInfo, setSiteInfo] = useState<{ siteType: string; pagesFound: number; baseUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiSubSteps, setAiSubSteps] = useState<AiSubStep[]>([]);

  /** Shared NDJSON stream reader — handles progress, info, complete, and error messages. */
  const processStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      setError("Streaming not supported");
      setState("error");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          if (msg.type === "progress") {
            // Track AI sub-steps separately
            if (msg.dimension === "AI Analysis" && msg.detail) {
              if (msg.status === "running") {
                setAiSubSteps(prev => {
                  // Mark previous running sub-step as complete
                  const updated = prev.map(s =>
                    s.status === "running" ? { ...s, status: "complete" as const } : s
                  );
                  // Push new sub-step
                  return [...updated, { label: msg.detail, status: "running" as const }];
                });
              } else if (msg.status === "complete" || msg.status === "skipped") {
                // Mark all remaining as complete
                setAiSubSteps(prev =>
                  prev.map(s => ({ ...s, status: "complete" as const }))
                );
              }
            }

            setProgress(prev => {
              const existing = prev.findIndex(p => p.dimension === msg.dimension);
              const step: ProgressStep = {
                dimension: msg.dimension,
                status: msg.status,
                score: msg.score,
                detail: msg.detail,
              };
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = step;
                return updated;
              }
              return [...prev, step];
            });
          } else if (msg.type === "info") {
            setSiteInfo({
              siteType: msg.siteType,
              pagesFound: msg.pagesFound,
              baseUrl: msg.baseUrl,
            });
          } else if (msg.type === "complete") {
            setResult(msg.result);
            setState("results");
          } else if (msg.type === "error") {
            setError(msg.message);
            setState("error");
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }, []);

  const handleAudit = useCallback(async (url: string) => {
    setState("loading");
    setProgress([]);
    setSiteInfo(null);
    setResult(null);
    setError(null);
    setAiSubSteps([]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (response.status === 429) {
        const data = await response.json();
        setError(data.message || "Rate limited. Please try again later.");
        setState("error");
        return;
      }

      if (!response.ok && !response.body) {
        setError("Failed to start audit. Please try again.");
        setState("error");
        return;
      }

      await processStream(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please check your connection.");
      setState("error");
    }
  }, [processStream]);

  const handleUpload = useCallback(async (file: File) => {
    setState("loading");
    setProgress([]);
    setSiteInfo(null);
    setResult(null);
    setError(null);
    setAiSubSteps([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/audit/upload", {
        method: "POST",
        body: formData,
      });

      if (response.status === 429) {
        const data = await response.json();
        setError(data.message || "Rate limited. Please try again later.");
        setState("error");
        return;
      }

      if (!response.ok && !response.body) {
        const data = await response.json().catch(() => ({}));
        setError((data as { message?: string }).message || "Failed to process upload. Please try again.");
        setState("error");
        return;
      }

      await processStream(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please check your connection.");
      setState("error");
    }
  }, [processStream]);

  const handleReset = useCallback(() => {
    setState("idle");
    setResult(null);
    setProgress([]);
    setSiteInfo(null);
    setError(null);
    setAiSubSteps([]);
  }, []);

  const aiStepStatus = progress.find(s => s.dimension === "AI Analysis")?.status ?? "pending";

  const reportMarkdown = result?.generatedFiles?.["remediation-report.md"];
  const reportIsAiEnhanced = result?.aiMode === "ai-enhanced" && result?.aiDiagnostics?.some(d => d.step === "Report Enhancement" && d.success);

  return (
    <>
      {state === "idle" && (
        <>
          <SearchHero onSubmit={handleAudit} onUpload={handleUpload} isLoading={false} />

          {/* What We Check section */}
          <section className="mx-auto max-w-5xl px-4 pb-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
              What We Check
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIMENSIONS_EXPLAINED.map((dim) => (
                <div
                  key={dim.name}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50"
                >
                  <dim.icon className="mb-2 h-5 w-5 text-accent" />
                  <h3 className="mb-1 text-sm font-semibold text-foreground">
                    {dim.name}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({dim.weight})
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">{dim.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {state === "loading" && (
        <AuditProgress
          steps={progress}
          siteInfo={siteInfo}
          aiSubSteps={aiSubSteps}
          aiStatus={aiStepStatus}
        />
      )}

      {state === "error" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="rounded-lg border border-fail/30 bg-fail/10 p-6 max-w-md">
            <p className="text-lg font-semibold text-fail mb-2">Audit Failed</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {state === "results" && result && (
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <ScoreDisplay
            score={result.overallScore}
            grade={result.grade}
            siteType={result.siteType}
            pagesAudited={result.pagesAudited}
            url={result.url}
            aiMode={result.aiMode}
            aiDiagnostics={result.aiDiagnostics}
          />

          {/* Priority actions */}
          {result.priorities.length > 0 && (
            <div className="mb-8 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Top Priorities</h3>
              <ol className="space-y-2">
                {result.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Remediation Report */}
          {reportMarkdown && (
            <RemediationReport
              markdown={reportMarkdown}
              aiEnhanced={reportIsAiEnhanced}
            />
          )}

          {/* Dimension cards */}
          <div className="mt-8 space-y-3">
            {result.dimensions.map((dim, i) => (
              <DimensionCard key={dim.id} dimension={dim} index={i} />
            ))}
          </div>

          {/* Generated Files Panel */}
          <GeneratedFilesPanel
            files={result.generatedFiles}
            aiMode={result.aiMode}
            downloadId={result.downloadId}
          />

          {/* Fixed Pages (opt-in) */}
          {result.fixPagesId && (
            <FixedPagesPanel fixPagesId={result.fixPagesId} />
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="h-4 w-4" />
              Audit Another Site
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
