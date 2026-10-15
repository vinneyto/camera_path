import type { ComponentType } from "react";
/** Ready components without required props. React owns their mount/cleanup. */
export type SlotComponents = readonly ComponentType[];
/** The complete list of host containers. Every section and every slot is optional. */
export interface FeatureSlots {
  readonly settings?: { readonly content?: SlotComponents };
  readonly dashboard?: { readonly content?: SlotComponents };
  readonly library?: {
    readonly content?: SlotComponents;
    readonly details?: SlotComponents;
  };
  readonly header?: { readonly controls?: SlotComponents };
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
    readonly effects?: SlotComponents;
    readonly tracks?: SlotComponents;
  };
}
export type SlotName = {
  [
    Section in keyof FeatureSlots
  ]-?: `${Section}.${keyof NonNullable<FeatureSlots[Section]> & string}`;
}[keyof FeatureSlots];
