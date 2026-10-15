"use client";
import { Slot } from "@camera-path/slots";

import { SettingsMenu } from "./settings-menu";
/** The host owns the header shell; features supply the controls slot. */
export function AuthControl() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <SettingsMenu />
      <Slot name="header.controls" />
    </div>
  );
}
