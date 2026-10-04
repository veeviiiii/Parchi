import type { Metadata } from "next";
import {
  Manrope,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Oriya,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import "./globals.css";
import "./parchi.css";

// Manrope for all text. The Noto fonts draw "Parchi" in Indian scripts (hero word, language menu).
// next/font needs literal options. preload: false = each script font loads only when a page uses it.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "700", "800"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-noto-deva", weight: "700", preload: false });
const beng = Noto_Sans_Bengali({ variable: "--font-noto-beng", weight: "700", preload: false });
const guj = Noto_Sans_Gujarati({ variable: "--font-noto-guj", weight: "700", preload: false });
const kan = Noto_Sans_Kannada({ variable: "--font-noto-kan", weight: "700", preload: false });
const tam = Noto_Sans_Tamil({ variable: "--font-noto-tam", weight: "700", preload: false });
const tel = Noto_Sans_Telugu({ variable: "--font-noto-tel", weight: "700", preload: false });
const mal = Noto_Sans_Malayalam({ variable: "--font-noto-mal", weight: "700", preload: false });
const guru = Noto_Sans_Gurmukhi({ variable: "--font-noto-guru", weight: "700", preload: false });
const ori = Noto_Sans_Oriya({ variable: "--font-noto-ori", weight: "700", preload: false });
const FONTS = [manrope, deva, beng, guj, kan, tam, tel, mal, guru, ori].map((font) => font.variable).join(" ");

export const metadata: Metadata = {
  title: "Parchi — From chat to clarity",
  description:
    "Parchi turns messy WhatsApp chats into clean, structured orders with Gemma 4. Bills, a community feed, and who owes what.",
};

// Runs before the page paints, so the saved theme shows without a flash (same as the design's HTML).
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("parchi-theme")}catch(e){}if(["classic","vintage","mono"].indexOf(t)<0)t="classic";document.documentElement.dataset.theme=t})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="classic" data-scroll-behavior="smooth" className={FONTS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
