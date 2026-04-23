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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {d.starQuality.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {starQuality.burstDetected && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            {d.starQuality.burst}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.factor * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">{d.starQuality.factor}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.recent * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">{d.starQuality.recentUqs}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.historical * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {d.starQuality.historicalUqs}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{d.starQuality.footnote}</p>
      </CardContent>
    </Card>
  );
}
