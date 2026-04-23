"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CategoryScore } from "@/lib/types";

function barColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

export function CategoryCards({
  categoryScores,
}: {
  categoryScores: Record<string, CategoryScore>;
}) {
  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories available.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, cat]) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {cat.name || key}
              </CardTitle>
              {cat.insufficient ? (
                <Badge variant="secondary" className="text-xs">
                  Insufficient Data
                </Badge>
              ) : (
                <span className="text-lg font-bold">
                  {Math.round(cat.score)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!cat.insufficient && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${barColor(cat.score)}`}
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
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{name.replace(/_/g, " ")}</span>
                    <span className="font-mono">
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
