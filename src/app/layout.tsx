import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/contexts/locale-context";
import { TopNav } from "@/components/layout/TopNav";
import { BottomLinks } from "@/components/layout/BottomLinks";
import { TooltipProvider } from "./tooltip-provider";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-kr",
  display: "swap",
});

function readLocaleFromHeaders(h: Headers): Locale {
  return h.get("x-rpi-locale") === "ko" ? "ko" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const locale = readLocaleFromHeaders(h);
  const m = getDictionary(locale).meta;
  return {
    title: m.title,
    description: m.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const locale = readLocaleFromHeaders(h);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col bg-background text-foreground font-sans`}
      >
        <LocaleProvider locale={locale}>
          <TooltipProvider>
            <TopNav />
            {children}
            <BottomLinks />
          </TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
