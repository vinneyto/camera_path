"use client";

import { UserSettingsPanel } from "@/features/user-settings";
import { ProfileControl } from "./profile-control";

export function AuthControl() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <UserSettingsPanel />
      <ProfileControl />
    </div>
  );
}
