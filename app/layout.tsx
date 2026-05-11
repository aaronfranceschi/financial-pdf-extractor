import type { Metadata } from "next";
import { Maven_Pro, JetBrains_Mono as JetBrainsMono } from "next/font/google";
import "./globals.css";
import "sonner/dist/styles.css";

import { Toaster } from "@/components/toaster";

const sans = Maven_Pro({
  subsets: ["latin"],
  variable: "--font-maven-pro",
  display: "swap",
});

const mono = JetBrainsMono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Financial PDF Extraction",
  description:
    "Upload financial PDFs, extract text locally, structure fields with OpenAI, review, and export CSV or Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} min-h-screen font-sans`}>
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,hsla(240,100%,68%,0.18),transparent_60%),radial-gradient(900px_500px_at_110%_-20%,hsla(199,93%,72%,0.16),transparent_58%),linear-gradient(to_bottom,#fafafa,white)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[420px] max-w-[1200px] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,transparent,rgba(109,124,246,0.25),transparent_38%)] opacity-60 blur-[90px] sm:block" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
