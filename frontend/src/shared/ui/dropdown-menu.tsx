"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { CONTEXT_MENU_Z_INDEX } from "./z-order";

interface DropdownMenuProps {
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }[];
  onCloseAutoFocus?: ComponentProps<typeof Menu.Content>["onCloseAutoFocus"];
}

export function DropdownMenu({
  trigger,
  items,
  onCloseAutoFocus,
}: DropdownMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          onCloseAutoFocus={onCloseAutoFocus}
          className="min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX }}
        >
          {items.map((item) => (
            <Menu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                item.destructive
                  ? "text-destructive data-[highlighted]:bg-destructive/10"
                  : "data-[highlighted]:bg-accent",
              )}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
