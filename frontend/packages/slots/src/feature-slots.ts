import type { ComponentType } from "react";
import type { FeaturePage } from "./feature-page";
/** Ready components without required props. React owns their mount/cleanup. */
export type SlotComponents = readonly ComponentType[];
/** The complete list of host containers. Every section and every slot is optional. */
export interface FeatureSlots {
  readonly pages?: readonly FeaturePage[];
  readonly settings?: { readonly content?: SlotComponents };
  readonly dashboard?: { readonly content?: SlotComponents };
  readonly library?: {
    readonly content?: SlotComponents;
    readonly details?: SlotComponents;
  };
  readonly profile?: { readonly account?: SlotComponents };
  readonly navigation?: { readonly controls?: SlotComponents };
  readonly project?: {
    readonly root?: SlotComponents;
    readonly scene?: SlotComponents;
    readonly sidebar?: SlotComponents;
    readonly headerStatus?: SlotComponents;
    /** Components returning Command elements under the shared CommandsProvider. */
    readonly commands?: SlotComponents;
    readonly hints?: SlotComponents;
    readonly toolbar?: SlotComponents;
  };
  readonly timeline?: {
    readonly controls?: SlotComponents;
    readonly tracks?: SlotComponents;
  };
}
export type SlotSection = Exclude<keyof FeatureSlots, "pages">;
export type SlotName = {
  [
    Section in SlotSection
  ]-?: `${Section}.${keyof NonNullable<FeatureSlots[Section]> & string}`;
}[SlotSection];
