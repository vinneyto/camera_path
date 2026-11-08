"use client";
import { HOVERABLE, SELECTABLE } from "@camera-path/render-pipeline";
import { useSceneInteraction } from "@camera-path/store";
import type { ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";

type SceneObjectProps = Omit<ThreeElements["group"], "children" | "ref"> & {
  sceneObjectID: string;
  hoverable?: boolean;
  selectable?: boolean;
  children: (state: { hovered: boolean; selected: boolean }) => ReactNode;
};

export function SceneObject({
  sceneObjectID,
  hoverable = true,
  selectable = true,
  children,
  ...props
}: SceneObjectProps) {
  const group = useRef<Group>(null);
  const { hoveredObjectId, selectedObjectId } = useSceneInteraction();
  useLayoutEffect(() => {
    const object = group.current;
    if (!object) return;
    const flags = [
      [HOVERABLE, hoverable],
      [SELECTABLE, selectable],
    ] as const;
    const previous = flags.map(([layer]) => object.layers.isEnabled(layer));
    for (const [layer, enabled] of flags) {
      if (enabled) object.layers.enable(layer);
      else object.layers.disable(layer);
    }
    return () => {
      flags.forEach(([layer], index) => {
        if (previous[index]) object.layers.enable(layer);
        else object.layers.disable(layer);
      });
    };
  }, [hoverable, selectable, props.layers]);
  return (
    <group
      {...props}
      ref={group}
      userData={{ ...props.userData, sceneObjectID }}
    >
      {children({
        hovered: hoverable && hoveredObjectId === sceneObjectID,
        selected: selectable && selectedObjectId === sceneObjectID,
      })}
    </group>
  );
}
