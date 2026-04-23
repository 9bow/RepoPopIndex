"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/locale-context";

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
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!url.trim()) {
        setError(d.home.errUrlEmpty);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), period }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 503) {
            setError(d.home.err503);
            return;
          }
          const msg = data.error ?? data.message;
          setError(
            typeof msg === "string" && msg ? msg : d.home.errAnalysis
          );
          return;
        }

        router.push(`/report/${data.id}`);
      } catch {
        setError(d.home.errNetwork);
      } finally {
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
          className="h-12 pr-24 text-base"
          disabled={loading}
        />
        {platform && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {platform === "github" ? "GitHub" : "HuggingFace"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{d.home.period}</span>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
        {loading ? d.home.analyzing : d.home.analyze}
      </Button>
    </form>
  );
}
