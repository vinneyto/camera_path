"use client";
import type { ReactNode } from "react";
import { CONTEXT_MENU_Z_INDEX } from "./z-order";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity delay-150 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100 motion-reduce:transition-none"
        style={{ zIndex: CONTEXT_MENU_Z_INDEX }}
      >
        {label}
      </span>
    </span>
  );
}
