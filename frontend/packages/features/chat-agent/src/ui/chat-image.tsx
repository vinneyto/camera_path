"use client";
import Image from "next/image";
import type { ChatAttachment } from "@camera-path/types/api";
import { Button } from "@camera-path/ui-kit";
import { ImagePreview } from "@camera-path/ui-kit/image-preview";

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
      <ImagePreview name={image.name}>
        <Image
          src={image.url}
          alt={image.name}
          fill
          unoptimized
          sizes="90vw"
          className="object-contain"
        />
      </ImagePreview>
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
