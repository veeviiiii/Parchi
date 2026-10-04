import type { Metadata } from "next";
import { Hind, Kalam, Rozha_One } from "next/font/google";
import "./globals.css";

// All three by Indian Type Foundry, all with Devanagari.
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

// Rozha One only for the पर्ची wordmark.
const rozha = Rozha_One({
  variable: "--font-rozha-one",
  subsets: ["latin", "devanagari"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Parchi",
  description: "Parchi for everyone. Paste a messy chat, get a clean order, a proper bill, and a community in the loop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hind.variable} ${kalam.variable} ${rozha.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
