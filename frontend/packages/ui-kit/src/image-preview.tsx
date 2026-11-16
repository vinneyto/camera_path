"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { FLOATING_PANEL_Z_INDEX } from "./z-order";

export function ImagePreview({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Enlarge ${name}`}
          className="relative block aspect-square w-full rounded-lg bg-muted/30"
        >
          {children}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/70"
          style={{ zIndex: FLOATING_PANEL_Z_INDEX }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 flex h-[85dvh] w-[90vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-3"
          style={{ zIndex: FLOATING_PANEL_Z_INDEX + 1 }}
        >
          <Dialog.Title className="mb-2 pr-8 text-sm">{name}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Full-size image
          </Dialog.Description>
          <div className="relative min-h-0 flex-1">{children}</div>
          <Dialog.Close asChild>
            <Button
              aria-label="Close image"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1"
            >
              <X className="size-4" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
