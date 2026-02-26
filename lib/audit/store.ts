import type { GeneratedFiles, PageData } from "./types";
import { STORE_TTL_MS } from "../constants";

interface StoreEntry {
  files: GeneratedFiles;
  expiresAt: number;
}

interface PageStoreEntry {
  pages: PageData[];
  schemaFiles: Record<string, string>;
  baseUrl: string;
  siteName: string;
  expiresAt: number;
}

const store = new Map<string, StoreEntry>();
const pageStore = new Map<string, PageStoreEntry>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
  for (const [key, entry] of pageStore) {
    if (entry.expiresAt < now) {
      pageStore.delete(key);
    }
  }
}

export function storeResult(files: GeneratedFiles): string {
  cleanup();
  const id = generateId();
  store.set(id, {
    files,
    expiresAt: Date.now() + STORE_TTL_MS,
  });
  return id;
}

export function getStoredResult(id: string): GeneratedFiles | null {
  cleanup();
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return entry.files;
}

export function storePages(
  pages: PageData[],
  schemaFiles: Record<string, string>,
  baseUrl: string,
  siteName: string,
): string {
  cleanup();
  const id = generateId();
  pageStore.set(id, {
    pages,
    schemaFiles,
    baseUrl,
    siteName,
    expiresAt: Date.now() + STORE_TTL_MS,
  });
  return id;
}

export function getStoredPages(id: string): PageStoreEntry | null {
  cleanup();
  const entry = pageStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pageStore.delete(id);
    return null;
  }
  return entry;
}
