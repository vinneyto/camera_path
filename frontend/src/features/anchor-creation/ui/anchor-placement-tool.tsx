"use client";

import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Group, Matrix3, Raycaster, Vector2, Vector3 } from "three";

import type { Vec3 } from "@/entities/project";

export type AnchorPlacementPhase = "surface" | "height";

export interface AnchorPlacement {
  lift: number;
  surfaceNormal: Vec3;
  surfacePosition: Vec3;
}

interface SurfaceHit {
  normal: Vec3;
  position: Vec3;
}

interface AnchorPlacementToolProps {
  color: string;
  disabled: boolean;
  surfaceRoot: RefObject<Group | null>;
  onCancel: () => void;
  onComplete: (placement: AnchorPlacement) => void;
  onPhaseChange: (phase: AnchorPlacementPhase) => void;
}

const CLICK_TOLERANCE_PX = 4;
const AXIS_EXTENT = 100_000;
const WORLD_UP = new Vector3(0, 1, 0);

export function AnchorPlacementTool({
  color,
  disabled,
  surfaceRoot,
  onCancel,
  onComplete,
  onPhaseChange,
}: AnchorPlacementToolProps) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const [base, setBase] = useState<SurfaceHit | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Vec3 | null>(null);
  const baseRef = useRef<SurfaceHit | null>(null);
  const previewPositionRef = useRef<Vec3 | null>(null);
  const surfaceHitRef = useRef<SurfaceHit | null>(null);

  useEffect(() => {
    if (disabled) return;

    const element = gl.domElement;
    let pointerDown: Vector2 | null = null;

    function setRayFromEvent(event: PointerEvent) {
      const rect = element.getBoundingClientRect();
      const pointer = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    }

    function updatePreview(event: PointerEvent) {
      setRayFromEvent(event);

      const currentBase = baseRef.current;
      if (currentBase) {
        const basePosition = new Vector3(...currentBase.position);
        const axisStart = basePosition.clone().addScaledVector(WORLD_UP, -AXIS_EXTENT);
        const axisEnd = basePosition.clone().addScaledVector(WORLD_UP, AXIS_EXTENT);
        const pointOnRay = new Vector3();
        const pointOnAxis = new Vector3();
        raycaster.ray.distanceSqToSegment(axisStart, axisEnd, pointOnRay, pointOnAxis);
        const position = pointOnAxis.toArray() as Vec3;
        previewPositionRef.current = position;
        setPreviewPosition(position);
        return;
      }

      const root = surfaceRoot.current;
      if (!root) return;
      root.updateWorldMatrix(true, true);
      const intersection = raycaster.intersectObject(root, true)[0];
      if (!intersection) {
        surfaceHitRef.current = null;
        previewPositionRef.current = null;
        setPreviewPosition(null);
        return;
      }

      const normal = intersection.face?.normal
        .clone()
        .applyMatrix3(new Matrix3().getNormalMatrix(intersection.object.matrixWorld))
        .normalize() ?? WORLD_UP.clone();
      const hit = {
        normal: normal.toArray() as Vec3,
        position: intersection.point.toArray() as Vec3,
      };
      surfaceHitRef.current = hit;
      previewPositionRef.current = hit.position;
      setPreviewPosition(hit.position);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      pointerDown = new Vector2(event.clientX, event.clientY);
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.button !== 0 || !pointerDown) return;
      const distance = pointerDown.distanceTo(new Vector2(event.clientX, event.clientY));
      pointerDown = null;
      if (distance > CLICK_TOLERANCE_PX) return;

      const currentBase = baseRef.current;
      if (!currentBase) {
        const currentSurfaceHit = surfaceHitRef.current;
        if (!currentSurfaceHit) return;
        baseRef.current = currentSurfaceHit;
        previewPositionRef.current = currentSurfaceHit.position;
        setBase(currentSurfaceHit);
        setPreviewPosition(currentSurfaceHit.position);
        onPhaseChange("height");
        return;
      }

      setRayFromEvent(event);
      const basePosition = new Vector3(...currentBase.position);
      const axisStart = basePosition.clone().addScaledVector(WORLD_UP, -AXIS_EXTENT);
      const axisEnd = basePosition.clone().addScaledVector(WORLD_UP, AXIS_EXTENT);
      const pointOnAxis = new Vector3();
      raycaster.ray.distanceSqToSegment(axisStart, axisEnd, new Vector3(), pointOnAxis);
      const finalPosition = pointOnAxis.toArray() as Vec3;
      onComplete({
        lift: finalPosition[1] - currentBase.position[1],
        surfaceNormal: currentBase.normal,
        surfacePosition: currentBase.position,
      });
      baseRef.current = null;
      previewPositionRef.current = null;
      surfaceHitRef.current = null;
      setBase(null);
      setPreviewPosition(null);
      onCancel();
      onPhaseChange("surface");
    }

    function handlePointerLeave() {
      pointerDown = null;
      if (!baseRef.current) {
        surfaceHitRef.current = null;
        previewPositionRef.current = null;
        setPreviewPosition(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !baseRef.current) return;
      baseRef.current = null;
      previewPositionRef.current = null;
      surfaceHitRef.current = null;
      setBase(null);
      setPreviewPosition(null);
      onPhaseChange("surface");
    }

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointerleave", handlePointerLeave);
    element.addEventListener("pointermove", updatePreview);
    element.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointerleave", handlePointerLeave);
      element.removeEventListener("pointermove", updatePreview);
      element.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [camera, disabled, gl, onCancel, onComplete, onPhaseChange, raycaster, surfaceRoot]);

  if (!previewPosition) return null;

  const lift = base ? previewPosition[1] - base.position[1] : 0;
  const showDistance = base && Math.abs(lift) > 0.1;
  return (
    <>
      {base && (
        <>
          <Line
            color={color}
            depthTest={false}
            lineWidth={1.5}
            points={[base.position, previewPosition]}
            renderOrder={100}
          />
          <mesh position={base.position} renderOrder={101}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      )}
      <mesh position={previewPosition} renderOrder={101}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {base && showDistance && (
        <Html
          center
          position={[
            previewPosition[0],
            base.position[1] + lift / 2,
            previewPosition[2],
          ]}
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded border bg-background/95 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
            {lift > 0 ? "+" : ""}{lift.toFixed(2)} m
          </div>
        </Html>
      )}
    </>
  );
}
