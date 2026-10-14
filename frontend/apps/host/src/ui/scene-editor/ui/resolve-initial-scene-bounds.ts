import type { SceneSurfaceBounds } from "@camera-path/scene-runtime/surface";

import { mergeSurfaceBounds } from "@host/ui/scene-editor/ui/merge-surface-bounds";

/** Ready models and pending model positions can be framed without waiting for downloads. */
export function resolveInitialSceneBounds(
  initialIds: readonly string[],
  currentIds: ReadonlySet<string>,
  ready: ReadonlyMap<string, SceneSurfaceBounds>,
  failed: ReadonlySet<string>,
  pending: ReadonlyMap<string, SceneSurfaceBounds> = new Map(),
): SceneSurfaceBounds | null {
  return mergeSurfaceBounds(
    initialIds.flatMap((id) => {
      if (!currentIds.has(id) || failed.has(id)) return [];
      const bounds = ready.get(id) ?? pending.get(id);
      return bounds ? [bounds] : [];
    }),
  );
}
