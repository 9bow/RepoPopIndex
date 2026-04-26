"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/contexts/locale-context";
import { MetricName } from "@/components/metric-name";
import type { CategoryScore } from "@/lib/types";

function barColor(score: number): string {
  if (score >= 80) return "bg-score-excellent";
  if (score >= 60) return "bg-score-good";
  if (score >= 40) return "bg-score-mid";
  if (score >= 20) return "bg-score-low";
  return "bg-score-poor";
}

export function CategoryCards({
  categoryScores,
}: {
  categoryScores: Record<string, CategoryScore>;
}) {
  const { d } = useLocale();
  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{d.categoryCards.none}</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, cat]) => (
        <Card key={key} className="border-border/70 transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">
                {cat.name || key}
              </CardTitle>
              {cat.insufficient ? (
                <Badge variant="secondary" className="text-xs">
                  {d.categoryCards.insufficient}
                </Badge>
              ) : (
                <span className="text-lg font-semibold font-display tabular-nums">
                  {Math.round(cat.score)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!cat.insufficient && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${barColor(cat.score)}`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            )}
            {cat.insufficient && cat.reason && (
              <p className="text-xs text-muted-foreground">{cat.reason}</p>
            )}
            <div className="space-y-1">
              {Object.entries(cat.metrics)
                .filter(([, m]) => m.raw !== null)
                .slice(0, 3)
                .map(([name, m]) => (
                  <div
                    key={name}
                    className="flex justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <MetricName metricKey={name} />
                    <span className="font-mono tabular-nums">
                      {typeof m.raw === "number" ? m.raw.toLocaleString() : "N/A"}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
