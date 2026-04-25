"use client";

import { Tooltip } from "@base-ui/react/tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delay={150}>{children}</Tooltip.Provider>;
}
