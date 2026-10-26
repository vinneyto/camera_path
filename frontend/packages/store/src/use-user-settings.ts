"use client";
import { useUserSettingsStore } from "./user-settings-store-provider";

export function useUserSettings() {
  return useUserSettingsStore((state) => state.userSettings);
}
