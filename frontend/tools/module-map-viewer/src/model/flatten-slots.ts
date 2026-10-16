import type { SlotComponent, SlotTree } from "./types";

export function flattenSlots(
  tree: SlotTree,
): { path: string; components: SlotComponent[] }[] {
  const rows: { path: string; components: SlotComponent[] }[] = [];
  function walk(value: SlotTree, prefix: string) {
    for (const [name, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${name}` : name;
      if (Array.isArray(entry)) rows.push({ path, components: entry });
      else walk(entry, path);
    }
  }
  walk(tree, "");
  return rows;
}
