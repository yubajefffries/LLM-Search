"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, MinusCircle, Sparkles } from "lucide-react";
import { DIMENSION_INFO } from "@/lib/constants";

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

interface AuditProgressProps {
  steps: ProgressStep[];
  siteInfo?: { siteType: string; pagesFound: number; baseUrl: string } | null;
  aiSubSteps?: AiSubStep[];
  aiStatus?: "pending" | "running" | "complete" | "skipped";
}

export function AuditProgress({ steps, siteInfo, aiSubSteps = [], aiStatus = "pending" }: AuditProgressProps) {
  // Phase 1: Crawl + 8 dimension checks
  const scanDimensions: ProgressStep[] = [
    { dimension: "Crawling site", status: "pending" },
    ...DIMENSION_INFO.map(d => ({
      dimension: d.name,
      status: "pending" as const,
    })),
  ];

  // Merge actual progress with template (scan dimensions only)
  const mergedScan = scanDimensions.map(dim => {
    const actual = steps.find(s => s.dimension === dim.dimension);
    return actual || dim;
  });

  const completedScanSteps = mergedScan.filter(s => s.status === "complete").length;
  const totalScanSteps = mergedScan.length;
  const scanPhaseComplete = completedScanSteps === totalScanSteps;

  // AI step from progress
  const aiStep = steps.find(s => s.dimension === "AI Analysis");
  const effectiveAiStatus = aiStep?.status ?? aiStatus;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
        Auditing Your Site
      </h2>
      {siteInfo && (
        <p className="mb-2 text-center text-sm text-muted-foreground">
          {siteInfo.siteType} site — {siteInfo.pagesFound} pages found
        </p>
      )}

      {/* Step counter */}
      <p className="mb-6 text-center text-xs text-muted-foreground">
        Step {Math.min(completedScanSteps + 1, totalScanSteps + (effectiveAiStatus !== "pending" ? 1 : 0))} of {totalScanSteps + 1}
      </p>

      {/* Phase 1: Site Scan */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {mergedScan.map((step, i) => (
            <motion.div
              key={step.dimension}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className={`flex items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                step.status === "running" ? "bg-accent/5" : ""
              }`}
            >
              <div className="mt-0.5">
                {step.status === "complete" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-pass" />
                ) : step.status === "skipped" ? (
                  <MinusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : step.status === "running" ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      step.status === "complete"
                        ? "text-sm text-foreground"
                        : step.status === "skipped"
                        ? "text-sm text-muted-foreground"
                        : step.status === "running"
                        ? "text-sm font-medium text-accent"
                        : "text-sm text-muted-foreground/60"
                    }
                  >
                    {step.dimension}
                  </span>
                  {step.status === "complete" && step.score !== undefined && (
                    <span className="ml-auto text-sm font-medium text-muted-foreground">
                      {step.score}/100
                    </span>
                  )}
                  {step.status === "skipped" && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      skipped
                    </span>
                  )}
                </div>
                <AnimatePresence mode="wait">
                  {step.detail && step.status === "running" && (
                    <motion.p
                      key={step.detail}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="mt-0.5 text-xs text-muted-foreground"
                    >
                      {step.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Phase 2: Claude AI Analysis card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: scanPhaseComplete || effectiveAiStatus !== "pending" ? 1 : 0.4, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`mt-6 rounded-lg border p-4 transition-all ${
          effectiveAiStatus === "running"
            ? "ai-active-glow border-accent/30 bg-accent/5"
            : effectiveAiStatus === "complete"
            ? "border-pass/30 bg-pass/5"
            : effectiveAiStatus === "skipped"
            ? "border-border bg-muted/30"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          {effectiveAiStatus === "running" ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
          ) : effectiveAiStatus === "complete" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-pass" />
          ) : effectiveAiStatus === "skipped" ? (
            <MinusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
          )}
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${
              effectiveAiStatus === "running" ? "text-accent" :
              effectiveAiStatus === "complete" ? "text-pass" :
              "text-muted-foreground/60"
            }`} />
            <span className={`font-medium ${
              effectiveAiStatus === "running" ? "text-accent" :
              effectiveAiStatus === "complete" ? "text-foreground" :
              effectiveAiStatus === "skipped" ? "text-muted-foreground" :
              "text-muted-foreground/60"
            }`}>
              Claude AI Analysis
            </span>
          </div>
        </div>

        {/* AI sub-steps */}
        {effectiveAiStatus === "running" && aiSubSteps.length > 0 && (
          <div className="ml-8 mt-3 space-y-2">
            <AnimatePresence>
              {aiSubSteps.map((sub, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  {sub.status === "complete" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-pass" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                  )}
                  <span className={`text-xs ${
                    sub.status === "complete" ? "text-muted-foreground" : "text-accent"
                  }`}>
                    {sub.label}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Skipped message */}
        {effectiveAiStatus === "skipped" && (
          <p className="ml-8 mt-2 text-xs text-muted-foreground">
            Running in basic mode (no API key)
          </p>
        )}

        {/* Complete message */}
        {effectiveAiStatus === "complete" && (
          <p className="ml-8 mt-2 text-xs text-pass">
            Claude AI analysis complete
          </p>
        )}
      </motion.div>
    </div>
  );
}
