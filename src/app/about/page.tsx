import Link from "next/link";
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
    { id: "mission", title: a.missionTitle, body: a.missionBody },
    { id: "data-sources", title: a.dataSourcesTitle, body: a.dataSourcesBody },
    { id: "open-source", title: a.openSourceTitle, body: a.openSourceBody, seeAlso: { href: "/methodology", label: d.nav.methodology } },
    { id: "contact", title: a.contactTitle, body: a.contactBody, href: `https://${a.contactBody}` },
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
        {sections.map(({ id, title, body, href, seeAlso }) => (
          <section key={id} id={id} className="space-y-2">
            <h2 className="text-lg font-semibold font-display tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {body}
                </a>
              ) : body}
            </p>
            {seeAlso && (
              <Link href={seeAlso.href} className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors">
                → {seeAlso.label}
              </Link>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
