"use client";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ChatAttachment } from "@camera-path/types/api";
import { Button, FLOATING_PANEL_Z_INDEX } from "@camera-path/ui-kit";

export function ChatImage({
  image,
  onContinue,
  disabled,
}: {
  image: ChatAttachment;
  onContinue?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border">
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={`Enlarge ${image.name}`}
            className="relative block aspect-square w-full bg-muted/30"
          >
            <Image
              src={image.url}
              alt={image.name}
              fill
              unoptimized
              sizes="320px"
              className="object-contain"
            />
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
            <Dialog.Title className="mb-2 pr-8 text-sm">
              {image.name}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Full-size reference image
            </Dialog.Description>
            <div className="relative min-h-0 flex-1">
              <Image
                src={image.url}
                alt={image.name}
                fill
                unoptimized
                sizes="90vw"
                className="object-contain"
              />
            </div>
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
      <div className="space-y-1 p-2">
        <p
          className="truncate text-[10px] text-muted-foreground"
          title={image.name}
        >
          {image.name}
        </p>
        {onContinue && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-full text-[11px]"
            disabled={disabled}
            onClick={onContinue}
          >
            Continue with this image
          </Button>
        )}
      </div>
    </div>
  );
}
