"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Copy, Check, Download, ChevronDown, Sparkles } from "lucide-react";

interface RemediationReportProps {
  markdown: string;
  aiEnhanced?: boolean;
}

interface Section {
  heading: string;
  content: string;
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
          {label}
        </>
      )}
    </button>
  );
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
      }
      currentHeading = h2Match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentHeading || currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
  }

  return sections;
}

function renderMarkdownLine(line: string): React.ReactNode {
  // Bold
  let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  // Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs font-mono">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: processed }} />;
}

function SectionContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-sm text-muted-foreground leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Table header
        if (line.startsWith("|") && lines[i + 1]?.startsWith("|---")) {
          const cells = line.split("|").filter(Boolean).map(c => c.trim());
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {cells.map((cell, ci) => (
                      <th key={ci} className="border border-border bg-muted/50 px-2 py-1 text-left font-medium text-foreground">
                        {renderMarkdownLine(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          );
        }
        // Table separator
        if (line.startsWith("|---")) return null;
        // Table row (not header)
        if (line.startsWith("|") && i > 0 && !lines[i - 1]?.startsWith("|---")) {
          // Find the table start to check if this is a body row
          const cells = line.split("|").filter(Boolean).map(c => c.trim());
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  <tr>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="border border-border px-2 py-1">
                        {renderMarkdownLine(cell)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="shrink-0 text-accent font-medium">{line.match(/^\d+/)?.[0]}.</span>
              <span>{renderMarkdownLine(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }

        // Bullet list
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="shrink-0 text-accent">-</span>
              <span>{renderMarkdownLine(line.substring(2))}</span>
            </div>
          );
        }

        // H3 heading
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-foreground">
              {line.substring(4)}
            </h4>
          );
        }

        // Horizontal rule
        if (line.trim() === "---") {
          return <hr key={i} className="border-border my-2" />;
        }

        // Regular paragraph
        return <p key={i}>{renderMarkdownLine(line)}</p>;
      })}
    </div>
  );
}

export function RemediationReport({ markdown, aiEnhanced }: RemediationReportProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const sections = useMemo(() => parseSections(markdown), [markdown]);

  const toggleSection = useCallback((index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "remediation-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown]);

  if (!markdown) return null;

  // Extract the header section (first section before any ## heading)
  const headerSection = sections[0]?.heading === "" ? sections[0] : null;
  const bodySections = headerSection ? sections.slice(1) : sections;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-8 rounded-lg border border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Remediation Report</h3>
          {aiEnhanced && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              <Sparkles className="h-2.5 w-2.5" />
              AI-Enhanced
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={markdown} label="Copy Report" />
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Download report"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        </div>
      </div>

      {/* Header content (site info) */}
      {headerSection && (
        <div className="border-b border-border px-4 py-3">
          <SectionContent content={headerSection.content} />
        </div>
      )}

      {/* Collapsible sections */}
      <div className="divide-y divide-border">
        {bodySections.map((section, i) => {
          const isExpanded = expandedSections.has(headerSection ? i + 1 : i);
          return (
            <div key={i}>
              <button
                onClick={() => toggleSection(headerSection ? i + 1 : i)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                aria-expanded={isExpanded}
              >
                <span className="text-sm font-medium text-foreground">{section.heading}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  <SectionContent content={section.content} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
