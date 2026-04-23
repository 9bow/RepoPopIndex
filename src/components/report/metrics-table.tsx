"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CategoryScore } from "@/lib/types";

export function MetricsTable({
  categoryScores,
}: {
  categoryScores: Record<string, CategoryScore>;
}) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No metrics available.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, cat]) => (
        <Collapsible
          key={key}
          open={openCategories.has(key)}
          onOpenChange={() => toggle(key)}
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/50">
            <span className="text-sm font-medium">{cat.name || key}</span>
            <span className="text-sm text-muted-foreground">
              {cat.insufficient ? "Insufficient Data" : `${Math.round(cat.score)}/100`}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Raw</TableHead>
                  <TableHead className="text-right">Normalized</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(cat.metrics).map(([name, m]) => (
                  <TableRow key={name}>
                    <TableCell className="text-sm">
                      {name.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.raw !== null ? m.raw.toLocaleString() : "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.normalized !== null ? m.normalized.toFixed(3) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.weighted !== null ? m.weighted.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.weighted !== null
                        ? (m.weighted * 100).toFixed(1)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
