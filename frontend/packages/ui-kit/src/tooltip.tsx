"use client";
import { useContext, useId, useState, type ReactNode } from "react";
import { CONTEXT_MENU_Z_INDEX } from "./z-order";
import { TooltipContext } from "./tooltip-provider";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const localState = useState<string | null>(null);
  const [activeId, setActiveId] = useContext(TooltipContext) ?? localState;
  const close = () =>
    setActiveId((current) => (current === id ? null : current));
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.currentTarget.contains(event.target as Node)) setActiveId(id);
      }}
      onPointerLeave={close}
      onFocusCapture={(event) => {
        // A pointer click retains focus, but must not keep its tooltip open.
        // Ignore focus bubbling from a dialog rendered through a React portal.
        if (
          event.currentTarget.contains(event.target) &&
          event.target.matches(":focus-visible")
        )
          setActiveId(id);
      }}
      onBlurCapture={close}
      onClickCapture={close}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      {children}
      {activeId === id && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
