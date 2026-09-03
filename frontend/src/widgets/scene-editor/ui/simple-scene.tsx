import { forwardRef } from "react";
import type { Group } from "three";

interface SimpleSceneProps {
  dark: boolean;
}

export const SimpleScene = forwardRef<Group, SimpleSceneProps>(function SimpleScene({ dark }, ref) {

  return (
    <>
      <gridHelper
        args={[16, 32, dark ? "#39414e" : "#aaa59d", dark ? "#252c36" : "#c5c0b8"]}
        position={[0, 0.002, 0]}
      />
      <group ref={ref}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[16, 16]} />
          <meshStandardMaterial color={dark ? "#171c24" : "#d9d6d0"} roughness={0.92} />
        </mesh>
        <mesh castShadow position={[-2.2, 0.65, 0.5]}>
          <boxGeometry args={[1.3, 1.3, 1.3]} />
          <meshStandardMaterial color="#7699c9" roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0.2, 0.9, -1.2]}>
          <sphereGeometry args={[0.9, 32, 24]} />
          <meshStandardMaterial color="#d69072" roughness={0.6} />
        </mesh>
        <mesh castShadow position={[2.25, 0.8, 0.8]}>
          <cylinderGeometry args={[0.68, 0.9, 1.6, 32]} />
          <meshStandardMaterial color="#82aa8b" roughness={0.62} />
        </mesh>
        <mesh castShadow position={[1.1, 0.45, 2.5]} rotation={[0, 0.35, 0]}>
          <torusGeometry args={[0.55, 0.2, 20, 48]} />
          <meshStandardMaterial color="#c0a268" roughness={0.5} />
        </mesh>
      </group>
    </>
  );
});
