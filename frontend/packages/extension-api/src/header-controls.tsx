"use client";
import { SettingsMenu } from "./settings-menu";
import { ExtensionSlot } from "./extension-slot";
export function HeaderControls() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <SettingsMenu />
      <ExtensionSlot name="header.controls" />
    </div>
  );
}
