"use client";
import { Slot } from "@camera-path/slots";

import { Button, Modal } from "@camera-path/ui-kit";
import { Settings } from "lucide-react";
import { useState } from "react";
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Settings"
      trigger={
        <Button
          aria-label="Settings"
          className="size-10 md:size-8"
          size="icon"
          title="Settings"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      }
    >
      <div className="space-y-3">
        <Slot name="settings.content" />
      </div>
    </Modal>
  );
}
