import type { ThreeEvent } from "@react-three/fiber";
import { Vector3 } from "three";

import type { Vec3 } from "@/entities/project";

interface SimpleSceneProps {
  dark: boolean;
  onSurfaceClick: (position: Vec3, normal: Vec3) => void;
}

export function SimpleScene({ dark, onSurfaceClick }: SimpleSceneProps) {
  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const localNormal = event.face?.normal.clone() ?? new Vector3(0, 1, 0);
    const worldNormal = localNormal.transformDirection(event.object.matrixWorld).normalize();
    onSurfaceClick(event.point.toArray() as Vec3, worldNormal.toArray() as Vec3);
  }

  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color={dark ? "#171c24" : "#d9d6d0"} roughness={0.92} />
      </mesh>
      <gridHelper
        args={[16, 32, dark ? "#39414e" : "#aaa59d", dark ? "#252c36" : "#c5c0b8"]}
        position={[0, 0.002, 0]}
      />
      <mesh castShadow onClick={handleClick} position={[-2.2, 0.65, 0.5]}>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
        <meshStandardMaterial color="#7699c9" roughness={0.55} />
      </mesh>
      <mesh castShadow onClick={handleClick} position={[0.2, 0.9, -1.2]}>
        <sphereGeometry args={[0.9, 32, 24]} />
        <meshStandardMaterial color="#d69072" roughness={0.6} />
      </mesh>
      <mesh castShadow onClick={handleClick} position={[2.25, 0.8, 0.8]}>
        <cylinderGeometry args={[0.68, 0.9, 1.6, 32]} />
        <meshStandardMaterial color="#82aa8b" roughness={0.62} />
      </mesh>
      <mesh castShadow onClick={handleClick} position={[1.1, 0.45, 2.5]} rotation={[0, 0.35, 0]}>
        <torusGeometry args={[0.55, 0.2, 20, 48]} />
        <meshStandardMaterial color="#c0a268" roughness={0.5} />
      </mesh>
    </>
  );
}
