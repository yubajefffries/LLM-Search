export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
      <div className="mx-auto max-w-5xl px-4">
        <p>
          LLM Search — AI Visibility Audit Tool.{" "}
          Built by{" "}
          <a
            href="https://darkhorseit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            DarkHorse IT
          </a>
        </p>
      </div>
    </footer>
  );
}
