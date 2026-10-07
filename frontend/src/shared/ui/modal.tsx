"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button";
import { CONTEXT_MENU_Z_INDEX } from "./z-order";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  trigger,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX + 1 }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX + 2 }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                aria-label="Close dialog"
                size="icon"
                variant="ghost"
                type="button"
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
