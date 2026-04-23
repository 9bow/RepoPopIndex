"use client";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-blue-500";
  if (score >= 40) return "text-yellow-500";
  if (score >= 20) return "text-orange-500";
  return "text-red-500";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Highly Active";
  if (score >= 60) return "Active";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Low Activity";
  return "Minimal Activity";
}

function strokeColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#f97316";
  return "#ef4444";
}

export function ScoreGauge({ score }: { score: number }) {
  const rounded = Math.round(score);
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-48 w-48">
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-muted/30"
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
          <span className={`text-5xl font-bold ${scoreColor(score)}`}>
            {rounded}
          </span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div>
        <p className={`text-xl font-semibold ${scoreColor(score)}`}>
          {scoreLabel(score)}
        </p>
        <p className="text-sm text-muted-foreground">Popularity Index</p>
      </div>
    </div>
  );
}
