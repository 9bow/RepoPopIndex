import { headers } from "next/headers";
import type { Metadata } from "next";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

function readLocale(h: Awaited<ReturnType<typeof headers>>): Locale {
  return h.get("x-rpi-locale") === "ko" ? "ko" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const d = getDictionary(readLocale(h));
  return { title: `${d.about.title} — ${d.meta.title}` };
}

export default async function AboutPage() {
  const h = await headers();
  const d = getDictionary(readLocale(h));
  const a = d.about;

  const sections = [
    { title: a.missionTitle, body: a.missionBody },
    { title: a.dataSourcesTitle, body: a.dataSourcesBody },
    { title: a.openSourceTitle, body: a.openSourceBody },
    { title: a.contactTitle, body: a.contactBody },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 pt-20 sm:pt-24 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-semibold font-display tracking-tight">
          {a.title}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">{a.intro}</p>
      </header>

      <div className="space-y-8">
        {sections.map(({ title, body }) => (
          <section key={title} className="space-y-2">
            <h2 className="text-lg font-semibold font-display tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
