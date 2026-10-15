"use client";
import { ThemeToggle } from "@camera-path/feature-appearance";
import { ProfileControl } from "@camera-path/feature-identity";
import { SettingsMenu } from "./settings-menu";
/** The header slot is composed explicitly by the host. */
export function AuthControl() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <SettingsMenu />
      <ProfileControl />
      <ThemeToggle />
    </div>
  );
}
