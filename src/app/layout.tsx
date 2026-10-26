import type { Metadata } from "next";
import { Geist, Literata } from "next/font/google";

import { ReviewPromptProvider } from "@/components/ReviewPrompt";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** A serif designed for long-form reading, used for headings and the reader. */
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Shelfie",
    template: "%s · Shelfie",
  },
  description: "Find, shelve and read free public-domain books from Project Gutenberg.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${literata.variable}`}>
      <body>
        <SiteHeader />
        <main id="main-content">
          <ReviewPromptProvider>{children}</ReviewPromptProvider>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
