import { headers } from "next/headers";
import { UrlInput } from "@/components/url-input";
import { RecentReports } from "@/components/home/recent-reports";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { getRecentReports } from "@/lib/cache";

function readLocale(h: Awaited<ReturnType<typeof headers>>): Locale {
  return h.get("x-rpi-locale") === "ko" ? "ko" : "en";
}

export default async function Home() {
  const h = await headers();
  const d = getDictionary(readLocale(h));
  const recentItems = await getRecentReports(12);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 sm:py-16 sm:pt-20">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="h-px w-12 bg-accent-vivid/60" aria-hidden />
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-semibold font-display tracking-tight text-balance">
            {d.home.title}
          </h1>
          <p className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground text-pretty">
            {d.home.subtitle}
          </p>
        </div>

        <UrlInput />

        <p className="max-w-md text-xs text-muted-foreground">{d.home.footnote}</p>
      </div>

      <RecentReports items={recentItems} />
    </main>
  );
}
