import * as React from "react";

import { cn } from "@/shared/lib/cn";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
