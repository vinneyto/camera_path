import type { ThreeElements } from "@react-three/fiber";
import type { Vec3 } from "@camera-path/types/project";
import { ANCHOR_SELECTION_SEGMENTS } from "../constants";
import { getAnchorSelectionGeometry } from "../lib/get-anchor-selection-geometry";

type AnchorSelectionColliderProps = Omit<
  ThreeElements["mesh"],
  "children" | "position" | "quaternion"
> & { surfaceOffset: Vec3 };

export function AnchorSelectionCollider({
  surfaceOffset,
  ...props
}: AnchorSelectionColliderProps) {
  const geometry = getAnchorSelectionGeometry(surfaceOffset);
  return (
    <mesh
      name="anchor-selection-collider"
      {...props}
      position={geometry.position}
      quaternion={geometry.quaternion}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <cylinderGeometry
        args={[
          geometry.radius,
          geometry.radius,
          geometry.height,
          ANCHOR_SELECTION_SEGMENTS,
        ]}
      />
      <meshBasicMaterial visible={false} depthWrite={false} />
    </mesh>
  );
}
