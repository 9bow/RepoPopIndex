"use client";

import { useLocale } from "@/contexts/locale-context";
import { scoreLabelKey } from "@/lib/i18n/dictionary";

function scoreColor(score: number): string {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-mid";
  if (score >= 20) return "text-score-low";
  return "text-score-poor";
}

function strokeColor(score: number): string {
  if (score >= 80) return "var(--score-excellent)";
  if (score >= 60) return "var(--score-good)";
  if (score >= 40) return "var(--score-mid)";
  if (score >= 20) return "var(--score-low)";
  return "var(--score-poor)";
}

export function ScoreGauge({ score }: { score: number }) {
  const { d } = useLocale();
  const rounded = Math.round(score);
  const key = scoreLabelKey(score);
  const label = d.scoreGauge[key];
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="relative h-44 w-44 sm:h-52 sm:w-52">
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-muted-foreground/20"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={strokeColor(score)}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className={`text-5xl sm:text-6xl font-semibold font-display tabular-nums ${scoreColor(score)}`}>
            {rounded}
          </span>
          <span className="text-xs text-muted-foreground tracking-wider uppercase">/100</span>
        </div>
      </div>
      <div className="text-center sm:text-left">
        <p className={`text-xl sm:text-2xl font-semibold font-display tracking-tight ${scoreColor(score)}`}>{label}</p>
        <p className="text-sm text-muted-foreground">{d.scoreGauge.index}</p>
      </div>
    </div>
  );
}
