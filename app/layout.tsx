import type { Metadata } from "next";
import { Hind, Kalam } from "next/font/google";
import "./globals.css";

// Both by Indian Type Foundry, both with Devanagari (CLAUDE.md section 13).
// Hind for all UI text.
const hind = Hind({
  variable: "--font-hind",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600"],
});

// Kalam (handwriting) only for item names on the order sheet.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin", "devanagari"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Buy Together",
  description: "Paste your group chat. Get one clean order.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hind.variable} ${kalam.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
