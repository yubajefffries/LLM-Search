import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLM Search — AI Visibility Audit",
  description:
    "Is your website visible to AI search engines? Get an instant 8-dimension audit covering ChatGPT, Claude, Perplexity, Gemini, and more.",
  openGraph: {
    title: "LLM Search — AI Visibility Audit",
    description:
      "Is your website visible to AI search engines? Get an instant 8-dimension audit.",
    url: "https://llm-search-one.vercel.app",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
