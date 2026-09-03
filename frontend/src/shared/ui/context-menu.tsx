"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/cn";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  position: ContextMenuPosition | null;
}

export function ContextMenu({ items, onClose, position }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose, position]);

  if (!position) return null;

  const left = typeof window === "undefined" ? position.x : Math.min(position.x, window.innerWidth - 188);
  const top = typeof window === "undefined" ? position.y : Math.min(position.y, window.innerHeight - 52);

  return createPortal(
    <div
      aria-label="Context menu"
      className="fixed z-50 min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-xl"
      ref={menuRef}
      role="menu"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      {items.map((item) => (
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors",
            item.destructive
              ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
              : "hover:bg-accent focus-visible:bg-accent",
            item.disabled && "pointer-events-none opacity-45",
          )}
          disabled={item.disabled}
          key={item.label}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          role="menuitem"
          type="button"
        >
          {item.destructive && <Trash2 className="size-3.5" />}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
