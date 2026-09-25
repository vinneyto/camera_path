import { useTexture } from "@react-three/drei";
import { DoubleSide } from "three";

import type { Vec3 } from "@/entities/project";

export function SurfaceTargetRing({
  position,
  highlighted = false,
}: {
  position: Vec3;
  highlighted?: boolean;
}) {
  const texture = useTexture("/anchor-target.png");
  return (
    <mesh
      position={position}
      raycast={() => undefined}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[0.12, 0.12]} />
      <meshBasicMaterial
        depthWrite={false}
        map={texture}
        opacity={highlighted ? 0.65 : 0.45}
        polygonOffset
        polygonOffsetFactor={-1}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}
