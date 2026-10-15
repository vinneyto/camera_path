"use client";
import type { ReactNode } from "react";
export function EffectMenuItem({
  children,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-45"
      onClick={(event) => {
        onSelect();
        event.currentTarget.closest("details")?.removeAttribute("open");
      }}
    >
      {children}
    </button>
  );
}
