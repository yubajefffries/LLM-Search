"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/file-upload";
import { Search, Loader2 } from "lucide-react";

const searchSchema = z.object({
  url: z
    .string()
    .min(1, "Enter a URL to audit")
    .refine(
      (val) => {
        try {
          const url = new URL(val.startsWith("http") ? val : `https://${val}`);
          return url.hostname.includes(".");
        } catch {
          return false;
        }
      },
      { message: "Please enter a valid URL (e.g., example.com)" }
    ),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface SearchHeroProps {
  onSubmit: (url: string) => void;
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export function SearchHero({ onSubmit, onUpload, isLoading }: SearchHeroProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: { url: "" },
  });

  function onFormSubmit(data: SearchFormData) {
    onSubmit(data.url);
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Is Your Website Visible
        <br />
        <span className="text-accent">to AI Search?</span>
      </h1>
      <p className="mb-8 max-w-xl text-lg text-muted-foreground">
        Get an instant 8-dimension audit of your site&apos;s AI search visibility.
        Find out if ChatGPT, Claude, Perplexity, and other AI tools can discover your content.
      </p>

      <Tabs.Root defaultValue="url" className="flex w-full max-w-xl flex-col items-center">
        <Tabs.List
          className="mb-4 inline-flex rounded-lg border border-border bg-muted/50 p-1"
          aria-label="Choose audit input method"
        >
          <Tabs.Trigger
            value="url"
            className="rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            URL
          </Tabs.Trigger>
          <Tabs.Trigger
            value="upload"
            className="rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Upload
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="url" className="w-full">
          <form
            onSubmit={handleSubmit(onFormSubmit)}
            className="flex w-full flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...register("url")}
                placeholder="Enter your website URL..."
                className="h-12 pl-10 text-base"
                disabled={isLoading}
                aria-label="Website URL to audit"
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" disabled={isLoading} className="h-12 px-8">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Auditing...
                </>
              ) : (
                "Audit My Site"
              )}
            </Button>
          </form>

          {errors.url && (
            <p className="mt-2 text-sm text-fail" role="alert">
              {errors.url.message}
            </p>
          )}
        </Tabs.Content>

        <Tabs.Content value="upload" className="w-full flex justify-center">
          <FileUpload onUpload={onUpload} isLoading={isLoading} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
