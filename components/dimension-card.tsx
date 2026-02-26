"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, XCircle, Info, Sparkles } from "lucide-react";
import type { DimensionResult } from "@/lib/audit/types";
import { getScoreBgColor } from "@/lib/utils";

interface DimensionCardProps {
  dimension: DimensionResult;
  index: number;
}

function FindingIcon({ type }: { type: string }) {
  switch (type) {
    case "pass":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-pass" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />;
    case "fail":
      return <XCircle className="h-4 w-4 shrink-0 text-fail" />;
    default:
      return <Info className="h-4 w-4 shrink-0 text-accent" />;
  }
}

function FindingBadge({ type }: { type: string }) {
  switch (type) {
    case "pass":
      return <Badge variant="pass">Pass</Badge>;
    case "warning":
      return <Badge variant="warning">Warning</Badge>;
    case "fail":
      return <Badge variant="fail">Fail</Badge>;
    default:
      return <Badge variant="outline">Info</Badge>;
  }
}

export function DimensionCard({ dimension, index }: DimensionCardProps) {
  const scoreBg = getScoreBgColor(dimension.score);
  const weightPercent = Math.round(dimension.weight * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <Accordion type="single" collapsible>
        <AccordionItem value={dimension.id} className="border border-border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-1 items-center gap-4 pr-4">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{dimension.name}</span>
                  <span className="text-xs text-muted-foreground">({weightPercent}%)</span>
                  {dimension.findings.some(f => f.detail?.includes("(AI-analyzed)")) && (
                    <Sparkles className="h-3.5 w-3.5 text-accent" aria-label="AI-enhanced" />
                  )}
                </div>
                <Progress
                  value={dimension.score}
                  className="mt-2 h-1.5"
                  indicatorClassName={scoreBg}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">{dimension.score}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              {dimension.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-muted/50 p-2">
                  <FindingIcon type={finding.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground">{finding.message}</span>
                      <FindingBadge type={finding.type} />
                      {finding.page && (
                        <span className="text-xs text-muted-foreground truncate">{finding.page}</span>
                      )}
                    </div>
                    {finding.detail && (
                      <p className="mt-1 text-xs text-muted-foreground">{finding.detail}</p>
                    )}
                  </div>
                </div>
              ))}
              {dimension.findings.length === 0 && (
                <p className="text-sm text-muted-foreground">No specific findings for this dimension.</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
}
