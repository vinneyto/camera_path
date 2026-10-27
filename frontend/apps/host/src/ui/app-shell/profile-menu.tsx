"use client";
import { Slot } from "@camera-path/slots";
import { Button, Modal, Tooltip } from "@camera-path/ui-kit";
import { UserRound } from "lucide-react";
import { useState } from "react";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip label="Profile & settings">
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Profile & settings"
        trigger={
          <Button aria-label="Profile & settings" size="icon" variant="ghost">
            <UserRound className="size-4" />
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
    </Tooltip>
  );
}
