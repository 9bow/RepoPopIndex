"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useLocale } from "@/contexts/locale-context";
import type { CategoryScore } from "@/lib/types";

interface Props {
  categoryScores: Record<string, CategoryScore>;
  excludedCategories: string[];
}

export function CategoryRadar({ categoryScores, excludedCategories }: Props) {
  const { d } = useLocale();
  const data = Object.entries(categoryScores).map(([key, cat]) => ({
    category: cat.name || key,
    score: excludedCategories.includes(key) ? 0 : cat.score,
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{d.categoryRadar.none}</p>
    );
  }

  return (
    <div className="h-64 w-full max-w-lg mx-auto sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value: string) => value.length > 8 ? value.slice(0, 7) + "…" : value}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Radar
            name={d.categoryRadar.seriesName}
            dataKey="score"
            stroke="var(--accent-vivid)"
            fill="var(--accent-vivid)"
            fillOpacity={0.18}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
