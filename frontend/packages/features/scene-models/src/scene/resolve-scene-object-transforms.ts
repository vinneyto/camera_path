import { Matrix4, Quaternion, Vector3 } from "three";
import type { SceneObject } from "@camera-path/types/api";

export interface ResolvedSceneObjectTransform {
  matrix: Matrix4;
  visible: boolean;
}

export function resolveSceneObjectTransforms(objects: readonly SceneObject[]) {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const resolved = new Map<string, ResolvedSceneObjectTransform>();
  // Resolve ancestors iteratively: the flat API response need not be topologically sorted.
  for (const object of objects) {
    const pending: SceneObject[] = [];
    const visiting = new Set<string>();
    let current: SceneObject | undefined = object;
    while (current && !resolved.has(current.id)) {
      if (visiting.has(current.id))
        throw new Error("Cyclic scene object hierarchy");
      visiting.add(current.id);
      pending.push(current);
      if (current.parent_id === null) break;
      const parent: SceneObject | undefined = byId.get(current.parent_id);
      if (!parent) throw new Error("Missing scene object parent");
      current = parent;
    }
    for (const entry of pending.reverse()) {
      const parent =
        entry.parent_id === null ? undefined : resolved.get(entry.parent_id);
      const local = new Matrix4().compose(
        new Vector3(...entry.position),
        new Quaternion(...entry.quaternion),
        new Vector3(...entry.scale),
      );
      resolved.set(entry.id, {
        matrix: parent ? parent.matrix.clone().multiply(local) : local,
        visible: entry.visible && (parent?.visible ?? true),
      });
    }
  }
  return resolved;
}
