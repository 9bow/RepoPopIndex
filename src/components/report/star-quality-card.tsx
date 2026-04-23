"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StarQuality {
  factor: number;
  recent: number;
  historical: number;
  burstDetected: boolean;
}

export function StarQualityCard({ starQuality }: { starQuality: StarQuality }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Star Quality Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {starQuality.burstDetected && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            Star burst detected — unusual spike in starring activity.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.factor * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Quality Factor</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.recent * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Recent UQS</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(starQuality.historical * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Historical UQS</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          UQS (User Quality Score) measures the authenticity of stargazers.
          Based on mixed sampling: 100 recent + 100 historical stargazers.
        </p>
      </CardContent>
    </Card>
  );
}
