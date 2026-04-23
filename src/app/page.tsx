import { UrlInput } from "@/components/url-input";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            RepoPopIndex
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            Measure real repository popularity, not vanity metrics.
            50+ signals. Anti-abuse star weighting. One score.
          </p>
        </div>

        <UrlInput />

        <p className="max-w-sm text-xs text-muted-foreground">
          Supports GitHub repositories and HuggingFace models/datasets.
          Analysis takes 15-30 seconds.
        </p>
      </div>
    </main>
  );
}
