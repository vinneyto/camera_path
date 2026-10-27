import type { ComponentType, SVGProps } from "react";

/** A standalone page and its navigation item, owned by the feature. */
export interface FeaturePage {
  readonly path: `/${string}`;
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly component: ComponentType;
}
