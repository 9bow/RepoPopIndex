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
    <div className="h-72 w-full max-w-lg mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
          />
          <Radar
            name={d.categoryRadar.seriesName}
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
