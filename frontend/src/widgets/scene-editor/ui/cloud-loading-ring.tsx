"use client";

import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { DoubleSide, type Mesh } from "three";
import type { GaussianCloudLoadProgress } from "@/shared/scene-surface";

interface CloudLoadingRingProps extends Omit<
  ThreeElements["group"],
  "children"
> {
  progress: GaussianCloudLoadProgress | null;
}

export function CloudLoadingRing({
  progress,
  ...props
}: CloudLoadingRingProps) {
  const arcRef = useRef<Mesh>(null);
  const fraction = progress?.fraction ?? null;
  const indeterminate = fraction === null;
  const angle =
    Math.PI * 2 * (indeterminate ? 0.2 : Math.max(0, Math.min(fraction, 1)));
  useEffect(() => {
    if (!indeterminate && arcRef.current) arcRef.current.rotation.z = 0;
  }, [indeterminate]);
  useFrame((_, delta) => {
    if (indeterminate && arcRef.current)
      arcRef.current.rotation.z -= delta * 1.5;
  });
  return (
    <group {...props} name="cloud-loading-ring">
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh name="cloud-loading-background" raycast={() => undefined}>
          <ringGeometry args={[0.21, 0.3, 96]} />
          <meshBasicMaterial
            color="white"
            opacity={0.18}
            transparent
            depthWrite={false}
            side={DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
        {angle > 0 && (
          <mesh
            name="cloud-loading-progress"
            ref={arcRef}
            raycast={() => undefined}
            renderOrder={1}
          >
            <ringGeometry args={[0.21, 0.3, 96, 1, Math.PI / 2, angle]} />
            <meshBasicMaterial
              color="white"
              opacity={0.65}
              transparent
              depthWrite={false}
              side={DoubleSide}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
