import Link from "next/link";
import { Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Search className="h-5 w-5 text-accent" />
          <span>LLM Search</span>
        </Link>
        <nav>
          <Link
            href="/about"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-2 py-1"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
