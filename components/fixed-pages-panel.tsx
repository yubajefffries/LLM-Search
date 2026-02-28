"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Download, Copy, Check, FileCode, Loader2 } from "lucide-react";

interface FixedPagesPanelProps {
  fixPagesId: string;
}

interface FixedPagesResult {
  files: Record<string, string>;
  summary?: Record<string, { size: number; changes: string }>;
  pageCount?: number;
  message?: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

export function FixedPagesPanel({ fixPagesId }: FixedPagesPanelProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<FixedPagesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch("/api/audit/fix-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixPagesId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errData = data as { error?: string; message?: string };
        throw new Error(errData.message || errData.error || "Failed to generate fixed pages");
      }

      const data = await response.json() as FixedPagesResult;
      setResult(data);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, [fixPagesId]);

  const handleDownloadZip = useCallback(async () => {
    try {
      const response = await fetch("/api/audit/fix-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/zip",
        },
        body: JSON.stringify({ fixPagesId }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fixed-pages.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, [fixPagesId]);

  // Idle state — show the generate button
  if (state === "idle") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="mt-6 rounded-lg border border-dashed border-border bg-card/50 p-6 text-center"
      >
        <FileCode className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <h3 className="mb-1 text-sm font-semibold text-foreground">Generate Updated Pages</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Create copies of your pages with missing meta tags, OG tags, and JSON-LD injected into the HTML.
        </p>
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <FileCode className="h-4 w-4" />
          Generate Fixed Pages
        </button>
      </motion.div>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-lg border border-border bg-card p-6 text-center"
      >
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Generating fixed pages...</p>
      </motion.div>
    );
  }

  // Error state
  if (state === "error") {
    const isExpired = error?.toLowerCase().includes("expired");
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6 rounded-lg border border-fail/30 bg-fail/5 p-4 text-center"
      >
        <p className="text-sm text-fail mb-3">{error}</p>
        {isExpired ? (
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
          >
            Run New Audit
          </a>
        ) : (
          <button
            onClick={handleGenerate}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Try again
          </button>
        )}
      </motion.div>
    );
  }

  // No pages needed fixing
  if (result?.message && (!result.files || Object.keys(result.files).length === 0)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-lg border border-pass/30 bg-pass/5 p-4 text-center"
      >
        <p className="text-sm text-pass">{result.message}</p>
      </motion.div>
    );
  }

  // Results
  const htmlFiles = Object.entries(result?.files || {}).filter(([name]) => name.endsWith(".html")) as [string, string][];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6 rounded-lg border border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Fixed Pages</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {htmlFiles.length} {htmlFiles.length === 1 ? "page" : "pages"}
          </span>
        </div>
        <button
          onClick={handleDownloadZip}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Download fixed pages as ZIP"
        >
          <Download className="h-3 w-3" />
          Download ZIP
        </button>
      </div>

      {/* File accordion */}
      <Accordion type="multiple" className="px-4">
        {htmlFiles.map(([filename, content]) => {
          const displayName = filename.replace("pages/", "").replace(".html", "");
          const summary = result?.summary?.[filename];

          return (
            <AccordionItem key={filename} value={filename} className="border-b border-border last:border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                  {summary && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                      {summary.changes}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <div className="mb-2 flex justify-end">
                    <CopyButton text={content} label={displayName} />
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-background p-3 text-xs text-foreground/80 font-mono leading-relaxed border border-border">
                    {content}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </motion.div>
  );
}
