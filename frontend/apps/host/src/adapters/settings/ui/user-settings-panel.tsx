"use client";
import { Settings } from "lucide-react";
import { useState } from "react";

import { Button, Modal } from "@camera-path/ui-kit";
import { useUserSettings } from "@host/adapters/settings/model/user-settings-provider";
import { settingsContributions } from "@host/composition/settings";

export function UserSettingsPanel() {
  const [open, setOpen] = useState(false);
  const settings = useUserSettings();

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
        {settingsContributions.map(({ id, Component }) => (
          <Component key={id} />
        ))}
      </div>
      {(settings.loading || settings.saving) && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {settings.loading ? "Loading settings…" : "Saving…"}
        </p>
      )}
      {settings.error && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-destructive" role="alert">
            {settings.error.message}
          </p>
          {!settings.ready && (
            <Button onClick={settings.retry} size="sm" variant="outline">
              Retry
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
