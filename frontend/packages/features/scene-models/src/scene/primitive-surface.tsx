"use client";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { Color, Group, Mesh, MeshLambertMaterial } from "three";
import type { SceneSurfaceProps } from "@camera-path/scene-runtime/surface/model/scene-surface-types";
import { createScenePrimitiveGeometry } from "./create-scene-primitive-geometry";
import { parseScenePrimitive } from "./parse-scene-primitive";
import { primitiveSurfaceHit } from "./primitive-surface-hit";
import {
  PRIMITIVE_DEFAULT_COLOR,
  PRIMITIVE_HOVER_GAIN,
  PRIMITIVE_SELECTED_GAIN,
} from "./primitive-constants";

type Props = Pick<
  SceneSurfaceProps,
  | "name"
  | "hovered"
  | "selected"
  | "onReady"
  | "onError"
  | "raycastable"
  | "onSurfacePointerDown"
  | "onSurfacePointerMove"
  | "onSurfacePointerUp"
  | "onPointerOut"
  | "onPointerCancel"
> & { parameters: string };

export function PrimitiveSurface({
  parameters,
  name,
  hovered,
  selected,
  onReady,
  onError,
  raycastable,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerUp,
  onPointerOut,
  onPointerCancel,
}: Props) {
  const group = useRef<Group>(null);
  const resource = useRef<Mesh | null>(null);
  const reportError = useEffectEvent((error: Error) => onError?.(error));
  const reportReady = useEffectEvent((mesh: Mesh) => {
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    const box = mesh.geometry.boundingBox!,
      sphere = mesh.geometry.boundingSphere!;
    onReady?.({
      bounds: {
        center: sphere.center.toArray(),
        radius: sphere.radius,
        min: box.min.toArray(),
        max: box.max.toArray(),
      },
    });
  });
  useLayoutEffect(() => {
    const parent = group.current;
    if (!parent) return;
    let mesh: Mesh | null = null;
    try {
      const descriptor = parseScenePrimitive(parameters);
      const geometry = createScenePrimitiveGeometry(descriptor.type);
      const material = new MeshLambertMaterial({
        color: descriptor.color ?? PRIMITIVE_DEFAULT_COLOR,
      });
      material.userData.baseColor = material.color.clone();
      mesh = new Mesh(geometry, material);
      mesh.name = name ?? "";
      parent.add(mesh);
      resource.current = mesh;
    } catch (error) {
      reportError(error instanceof Error ? error : new Error(String(error)));
    }
    return () => {
      resource.current = null;
      mesh?.removeFromParent();
      mesh?.geometry.dispose();
      if (mesh?.material instanceof MeshLambertMaterial)
        mesh.material.dispose();
    };
  }, [parameters, name]);
  useLayoutEffect(() => {
    const mesh = resource.current;
    if (!(mesh?.material instanceof MeshLambertMaterial)) return;
    mesh.material.color
      .copy(mesh.material.userData.baseColor as Color)
      .multiplyScalar(
        selected ? PRIMITIVE_SELECTED_GAIN : hovered ? PRIMITIVE_HOVER_GAIN : 1,
      );
  }, [parameters, name, hovered, selected]);
  useEffect(() => {
    if (resource.current) reportReady(resource.current);
  }, [parameters, name]);
  return (
    <group
      ref={group}
      userData={{ sceneSurfacePickable: raycastable }}
      {...(raycastable
        ? {
            onPointerDown: onSurfacePointerDown
              ? (event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  onSurfacePointerDown(primitiveSurfaceHit(event), event);
                }
              : undefined,
            onPointerMove: onSurfacePointerMove
              ? (event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  onSurfacePointerMove(primitiveSurfaceHit(event), event);
                }
              : undefined,
            onPointerUp: onSurfacePointerUp
              ? (event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  onSurfacePointerUp(primitiveSurfaceHit(event), event);
                }
              : undefined,
            onPointerOut,
            onPointerCancel,
          }
        : {})}
    />
  );
}
