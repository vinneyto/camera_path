"use client";
import { HOVERABLE } from "@camera-path/render-pipeline";
import { useSceneInteraction } from "@camera-path/store";
import type { ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";

type SceneObjectProps = Omit<ThreeElements["group"], "children" | "ref"> & {
  sceneObjectID: string;
  hoverable?: boolean;
  children: (state: { hovered: boolean }) => ReactNode;
};

export function SceneObject({
  sceneObjectID,
  hoverable = true,
  children,
  ...props
}: SceneObjectProps) {
  const group = useRef<Group>(null);
  const { hoveredObjectId } = useSceneInteraction();
  useLayoutEffect(() => {
    const object = group.current;
    if (!object) return;
    const wasEnabled = object.layers.isEnabled(HOVERABLE);
    if (hoverable) object.layers.enable(HOVERABLE);
    else object.layers.disable(HOVERABLE);
    return () => {
      if (wasEnabled) object.layers.enable(HOVERABLE);
      else object.layers.disable(HOVERABLE);
    };
  }, [hoverable, props.layers]);
  return (
    <group
      {...props}
      ref={group}
      userData={{ ...props.userData, sceneObjectID }}
    >
      {children({ hovered: hoverable && hoveredObjectId === sceneObjectID })}
    </group>
  );
}
