"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileArchive, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPE = "application/zip";
const ACCEPTED_EXTENSIONS = [".zip"];

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidZip(file: File): boolean {
  if (file.type === ACCEPTED_TYPE) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback((selected: File) => {
    setError(null);

    if (!isValidZip(selected)) {
      setError("Only .zip files are accepted.");
      setFile(null);
      return;
    }

    if (selected.size > MAX_SIZE_BYTES) {
      setError(`File too large (${formatBytes(selected.size)}). Maximum is 10 MB.`);
      setFile(null);
      return;
    }

    if (selected.size === 0) {
      setError("File is empty.");
      setFile(null);
      return;
    }

    setFile(selected);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const dropped = e.dataTransfer.files[0];
      if (dropped) validateAndSet(dropped);
    },
    [validateAndSet]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) validateAndSet(selected);
      // Reset input so re-selecting the same file triggers onChange
      if (inputRef.current) inputRef.current.value = "";
    },
    [validateAndSet]
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (file) onUpload(file);
  }, [file, onUpload]);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload a zip file by dropping it here or clicking to browse"
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragOver
            ? "border-accent bg-accent/10"
            : file
              ? "border-accent/50 bg-accent/5"
              : "border-border hover:border-accent/50 hover:bg-muted/50",
          error && "border-fail/50 bg-fail/5",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        {file ? (
          <>
            <FileArchive className="h-8 w-8 text-accent" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove selected file"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop your .zip file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse &middot; max 10 MB
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-fail" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit button */}
      {file && !error && (
        <Button
          type="button"
          size="lg"
          disabled={isLoading}
          onClick={handleSubmit}
          className="h-12 w-full px-8 sm:w-auto"
        >
          Audit Uploaded Files
        </Button>
      )}
    </div>
  );
}
