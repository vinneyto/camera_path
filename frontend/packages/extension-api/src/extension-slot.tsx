"use client";
import { useSlotContributions } from "./extension-provider";

/** Slots consume only the common component contract, never feature-specific props. */
export function ExtensionSlot({ name }: { name: string }) {
  return useSlotContributions(name).map(({ id, Component }) => (
    <Component key={id} />
  ));
}
