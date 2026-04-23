"use client";

import { useLocale } from "@/contexts/locale-context";
import { getMetricDescription, getMetricLabel } from "@/lib/i18n/metric-labels";

/** Short, human label with native hover `title` showing the full description. */
export function MetricName({ metricKey }: { metricKey: string }) {
  const { locale } = useLocale();
  return (
    <span
      className="cursor-help border-b border-dotted border-muted-foreground/80"
      title={getMetricDescription(metricKey, locale)}
    >
      {getMetricLabel(metricKey, locale)}
    </span>
  );
}
