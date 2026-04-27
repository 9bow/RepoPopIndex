import { headers } from "next/headers";
import type { Metadata } from "next";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

function readLocale(h: Awaited<ReturnType<typeof headers>>): Locale {
  return h.get("x-rpi-locale") === "ko" ? "ko" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const d = getDictionary(readLocale(h));
  return { title: `${d.methodology.title} — ${d.meta.title}` };
}

export default async function MethodologyPage() {
  const h = await headers();
  const d = getDictionary(readLocale(h));
  const m = d.methodology;

  const sections = [
    { id: "categories", title: m.categoriesTitle, body: m.categoriesBody },
    { id: "social-buzz", title: m.socialBuzzTitle, body: m.socialBuzzBody },
    { id: "star-abuse", title: m.starAbuseTitle, body: m.starAbuseBody },
    { id: "formula", title: m.formulaTitle, body: m.formulaBody },
    { id: "partial", title: m.partialTitle, body: m.partialBody },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 pt-20 sm:pt-24 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-semibold font-display tracking-tight">
          {m.title}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">{m.intro}</p>
      </header>

      <div className="space-y-8">
        {sections.map(({ id, title, body }) => (
          <section key={id} id={id} className="space-y-2">
            <h2 className="text-lg font-semibold font-display tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
