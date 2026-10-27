import type { ComponentType } from "react";
import type { FeatureSlots, SlotName } from "./feature-slots";
import type { FeaturePage } from "./feature-page";
declare const Component: ComponentType;
declare const RequiresProps: ComponentType<{ required: string }>;
export const empty: FeatureSlots = {};
export const optional: FeatureSlots = {
  settings: {},
  project: { scene: [Component] },
};
export const valid: SlotName = "project.scene";
// @ts-expect-error Unknown slot paths must fail typecheck.
export const invalid: SlotName = "project.unknown";
export const misspelled: FeatureSlots = {
  project: {
    // @ts-expect-error Unknown nested slots must fail typecheck.
    sceen: [Component],
  },
};
export const props: FeatureSlots = {
  settings: {
    content: [
      // @ts-expect-error The host cannot supply feature-specific required props.
      RequiresProps,
    ],
  },
};
export const page: FeaturePage = {
  path: "/example",
  label: "Example",
  icon: Component,
  component: Component,
};
// @ts-expect-error Page definitions are not slot component arrays.
export const pageSlot: SlotName = "pages.component";
export const pageProps: FeaturePage = {
  ...page,
  // @ts-expect-error The host cannot supply page-specific required props.
  component: RequiresProps,
};
export const relativePage: FeaturePage = {
  ...page,
  // @ts-expect-error Standalone pages must use absolute paths.
  path: "example",
};
