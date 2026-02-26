"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { DIMENSION_INFO } from "@/lib/constants";

interface ProgressStep {
  dimension: string;
  status: "pending" | "running" | "complete" | "skipped";
  score?: number;
}

interface AuditProgressProps {
  steps: ProgressStep[];
  siteInfo?: { siteType: string; pagesFound: number; baseUrl: string } | null;
}

export function AuditProgress({ steps, siteInfo }: AuditProgressProps) {
  const allDimensions: ProgressStep[] = [
    { dimension: "Crawling site", status: "pending" },
    ...DIMENSION_INFO.map(d => ({
      dimension: d.name,
      status: "pending" as const,
    })),
  ];

  // Merge actual progress with template
  const merged = allDimensions.map(dim => {
    const actual = steps.find(s => s.dimension === dim.dimension);
    return actual || dim;
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
        Auditing Your Site
      </h2>
      {siteInfo && (
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {siteInfo.siteType} site — {siteInfo.pagesFound} pages found
        </p>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {merged.map((step, i) => (
            <motion.div
              key={step.dimension}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-center gap-3 rounded-md px-3 py-2"
            >
              {step.status === "complete" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-pass" />
              ) : step.status === "running" ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
              )}
              <span
                className={
                  step.status === "complete"
                    ? "text-foreground"
                    : step.status === "running"
                    ? "text-accent"
                    : "text-muted-foreground/60"
                }
              >
                {step.dimension}
              </span>
              {step.status === "complete" && step.score !== undefined && (
                <span className="ml-auto text-sm font-medium text-muted-foreground">
                  {step.score}/100
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
