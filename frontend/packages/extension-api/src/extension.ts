import type { ComponentType } from "react";
import type { FeatureManifest } from "./manifest";

/** The complete public surface of an extension; its implementations stay private. */
export interface Extension {
  readonly manifest: FeatureManifest;
  readonly contributions: readonly {
    readonly id: string;
    readonly Component: ComponentType;
  }[];
  readonly register?: (host: never) => () => void;
}
