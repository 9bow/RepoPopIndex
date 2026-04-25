"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";

interface StarQuality {
  factor: number;
  recent: number;
  historical: number;
  burstDetected: boolean;
}

export function StarQualityCard({ starQuality }: { starQuality: StarQuality }) {
  const { d } = useLocale();
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {d.starQuality.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {starQuality.burstDetected && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:bg-destructive/15">
            {d.starQuality.burst}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center">
          <div>
            <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">
              {(starQuality.factor * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">{d.starQuality.factor}</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">
              {(starQuality.recent * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">{d.starQuality.recentUqs}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{d.starQuality.footnote}</p>
      </CardContent>
    </Card>
  );
}
