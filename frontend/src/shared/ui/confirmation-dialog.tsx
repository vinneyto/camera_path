"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode, RefObject } from "react";

import { Button } from "./button";
import { CONTEXT_MENU_Z_INDEX } from "./z-order";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  pending = false,
  error,
  onConfirm,
  returnFocusRef,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX + 1 }}
        />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX + 2 }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <AlertDialog.Title className="text-sm font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {children}
          {error && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button disabled={pending} variant="outline" type="button">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={onConfirm}
              type="button"
            >
              {pending ? "Deleting…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
