"use client";
import { Slot } from "@camera-path/slots";
import { Button, Modal, Tooltip } from "@camera-path/ui-kit";
import { UserRound } from "lucide-react";
import { useState } from "react";

export function ProfileMenu({ showLabel = false }: { showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const modal = (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Profile & settings"
      trigger={
        <Button
          aria-label="Profile & settings"
          size={showLabel ? "default" : "icon"}
          variant="ghost"
          className={
            showLabel ? "h-10 flex-1 justify-start gap-3 px-3" : undefined
          }
        >
          <UserRound className="size-4" />
          {showLabel && "Profile & settings"}
        </Button>
      }
    >
      <div className="space-y-5">
        <Slot name="profile.account" />
        <div className="space-y-3 border-t pt-4">
          <Slot name="settings.content" />
        </div>
      </div>
    </Modal>
  );
  return showLabel ? (
    modal
  ) : (
    <Tooltip label="Profile & settings">{modal}</Tooltip>
  );
}
