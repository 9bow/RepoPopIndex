"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/locale-context";
import { parseRepoUrl } from "@/lib/parsers/url-parser";

const PERIODS = ["1w", "1m", "3m", "6m", "1y"] as const;
const PERIOD_LABELS: Record<string, string> = {
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
};

function detectPlatform(url: string): "github" | "huggingface" | null {
  if (/github\.com/i.test(url)) return "github";
  if (/huggingface\.co|hf\.co/i.test(url)) return "huggingface";
  return null;
}

export function UrlInput() {
  const router = useRouter();
  const { d } = useLocale();
  const [url, setUrl] = useState("");
  const [period, setPeriod] = useState<string>("3m");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const platform = url.length > 5 ? detectPlatform(url) : null;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = url.trim();
      if (!trimmed) {
        setError(d.home.errUrlEmpty);
        return;
      }

      setLoading(true);
      try {
        const parsed = parseRepoUrl(trimmed);
        router.push(
          `/report/${parsed.platform}/${parsed.owner}/${parsed.repo}/${period}`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : d.home.errAnalysis);
        setLoading(false);
      }
    },
    [url, period, router, d.home]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
      <div className="relative">
        <Input
          type="text"
          placeholder={d.home.urlPlaceholder}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          className="h-12 sm:h-13 pr-24 text-base bg-background/80 backdrop-blur-sm"
          disabled={loading}
        />
        {platform && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/90 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
            {platform === "github" ? "GitHub" : "HuggingFace"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{d.home.period}</span>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-accent-vivid text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="h-11 w-full text-base font-medium" disabled={loading}>
        {loading ? d.home.analyzing : d.home.analyze}
      </Button>
    </form>
  );
}
