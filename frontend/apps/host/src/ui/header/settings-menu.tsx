"use client";
import { RendererSettings } from "@camera-path/feature-renderer-preferences";
import { GridSettings } from "@camera-path/feature-scene-grid";
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
        <RendererSettings />
        <GridSettings />
      </div>
    </Modal>
  );
}
