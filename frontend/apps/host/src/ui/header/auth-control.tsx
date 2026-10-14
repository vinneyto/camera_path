"use client";
import { ThemeToggle } from "@camera-path/feature-appearance";
import { ProfileControl } from "@camera-path/feature-identity";
import { UserSettingsPanel } from "@host/adapters/settings";

export function AuthControl() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <UserSettingsPanel />
      <ProfileControl />
      <ThemeToggle />
    </div>
  );
}
