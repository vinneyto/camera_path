import type { ComponentType } from "react";
import type { FeatureSlots, SlotName } from "./feature-slots";
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
