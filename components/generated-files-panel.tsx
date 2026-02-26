"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, FileText, FileJson, Sparkles, FileType } from "lucide-react";
import type { GeneratedFiles } from "@/lib/audit/types";

interface GeneratedFilesPanelProps {
  files: GeneratedFiles;
  aiMode: "ai-enhanced" | "basic" | "ai-failed";
  downloadId: string;
}

/** Determine icon and whether file is AI-generated */
function getFileInfo(filename: string, aiMode: string) {
  const isSchema = filename.endsWith(".json") || filename.startsWith("schema-");
  const isMd = filename.endsWith(".md");
  const isAiGenerated = aiMode === "ai-enhanced";

  // llms.txt and JSON-LD are AI-generated when in AI mode
  const aiFiles = ["llms.txt", "llms-full.txt"];
  const isThisAi = isAiGenerated && (aiFiles.includes(filename) || isSchema || filename === "remediation-report.md");

  return {
    icon: isSchema ? FileJson : isMd ? FileType : FileText,
    isAi: isThisAi,
  };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : `Copy ${label}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-pass" />
          <span className="text-pass">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

export function GeneratedFilesPanel({ files, aiMode, downloadId }: GeneratedFilesPanelProps) {
  const entries = Object.entries(files).filter(
    ([, content]) => content !== undefined && content.length > 0
  ) as [string, string][];

  if (entries.length === 0) return null;

  // Separate schema files from other files
  const schemaFiles = entries.filter(([name]) => name.endsWith(".json") || name.endsWith(".jsonld") || name.startsWith("schema/"));
  const otherFiles = entries.filter(([name]) => !name.endsWith(".json") && !name.endsWith(".jsonld") && !name.startsWith("schema/"));

  const fileCount = entries.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mt-8 rounded-lg border border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Generated Fixes</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {fileCount} files
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/download?id=${downloadId}`} download>
            <Download className="h-3.5 w-3.5" />
            Download ZIP
          </a>
        </Button>
      </div>

      {/* File accordion */}
      <Accordion type="multiple" className="px-4">
        {/* Individual files: robots.txt, sitemap.xml, llms.txt, llms-full.txt */}
        {otherFiles.map(([filename, content]) => {
          const { icon: Icon, isAi } = getFileInfo(filename, aiMode);
          return (
            <AccordionItem key={filename} value={filename} className="border-b border-border last:border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{filename}</span>
                  {isAi && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <div className="mb-2 flex justify-end">
                    <CopyButton text={content} label={filename} />
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-background p-3 text-xs text-foreground/80 font-mono leading-relaxed border border-border">
                    {content}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Schema JSON-LD files grouped */}
        {schemaFiles.length > 0 && (
          <AccordionItem value="schema-group" className="border-b border-border last:border-b-0">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Schema JSON-LD
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {schemaFiles.length} files
                </span>
                {aiMode === "ai-enhanced" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {schemaFiles.map(([filename, content]) => (
                  <div key={filename} className="rounded-md border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{filename}</span>
                      <CopyButton text={content} label={filename} />
                    </div>
                    <pre className="max-h-48 overflow-auto text-xs text-foreground/80 font-mono leading-relaxed">
                      {content}
                    </pre>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </motion.div>
  );
}
