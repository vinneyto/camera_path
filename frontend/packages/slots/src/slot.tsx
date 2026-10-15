"use client";
import type { FeatureSlots, SlotComponents, SlotName } from "./feature-slots";
import { useFeatureSlots } from "./slot-provider";
/** Mount the declared components in catalog order, then in their local array order. */
export function Slot({ name }: { name: SlotName }) {
  const features = useFeatureSlots();
  const [section, slot] = name.split(".") as [keyof FeatureSlots, string];
  return features.map((feature, featureIndex) => {
    const group = feature[section] as
      Readonly<Record<string, SlotComponents>> | undefined;
    return group?.[slot]?.map((Component, componentIndex) => (
      <Component key={`${featureIndex}:${componentIndex}`} />
    ));
  });
}
