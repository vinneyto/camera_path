import type { SceneSurfaceBounds } from "@/shared/scene-surface";

import { mergeSurfaceBounds } from "./merge-surface-bounds";

/** Undefined means that at least one initial cloud has not settled yet. */
export function resolveInitialSceneBounds(
  initialIds: readonly string[],
  currentIds: ReadonlySet<string>,
  ready: ReadonlyMap<string, SceneSurfaceBounds>,
  failed: ReadonlySet<string>,
): SceneSurfaceBounds | null | undefined {
  if (
    initialIds.some(
      (id) => currentIds.has(id) && !ready.has(id) && !failed.has(id),
    )
  )
    return undefined;
  return mergeSurfaceBounds(
    initialIds.flatMap((id) => {
      if (!currentIds.has(id)) return [];
      const bounds = ready.get(id);
      return bounds ? [bounds] : [];
    }),
  );
}
