"use client";

import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { useLocale } from "@/contexts/locale-context";
import { getMetricDescription, getMetricLabel } from "@/lib/i18n/metric-labels";

export function MetricName({ metricKey }: { metricKey: string }) {
  const { locale } = useLocale();
  const label = getMetricLabel(metricKey, locale);
  const desc = getMetricDescription(metricKey, locale);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <span
            className="cursor-help border-b border-dotted border-muted-foreground/70 pb-px text-left hover:border-foreground/70"
          />
        }
      >
        {label}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md">
            {desc}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
