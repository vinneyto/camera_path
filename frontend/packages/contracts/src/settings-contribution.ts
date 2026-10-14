import type { ComponentType } from "react";
export interface SettingsContribution {
  readonly id: string;
  readonly Component: ComponentType;
}
