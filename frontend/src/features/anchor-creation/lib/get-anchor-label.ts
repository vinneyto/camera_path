import type { Anchor } from "@/entities/project/model/types";

export function getAnchorLabel(anchors: Anchor[]): string {
  const used = new Set(anchors.map((anchor) => anchor.label));
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!used.has(candidate)) return candidate;
  }
  return `P${anchors.length + 1}`;
}
