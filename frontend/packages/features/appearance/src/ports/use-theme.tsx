"use client";
import { themeState } from "@camera-path/contracts/host-data";
import { toggleTheme } from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useTheme() {
  const theme = useData(manifest, themeState);
  const toggle = useRequestAction(manifest, toggleTheme);
  return { theme, toggleTheme: () => void toggle(undefined) };
}
