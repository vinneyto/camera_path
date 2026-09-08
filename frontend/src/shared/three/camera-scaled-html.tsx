"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type ComponentProps, type CSSProperties } from "react";
import { Group, Vector3 } from "three";

import { getCameraScaledHtmlScale } from "./get-camera-scaled-html-scale";

interface CameraScaledHtmlProps extends Omit<ComponentProps<typeof Html>, "distanceFactor" | "ref"> {
  distanceFactor: number;
}

export function CameraScaledHtml({
  children,
  distanceFactor,
  style,
  ...htmlProps
}: CameraScaledHtmlProps) {
  const camera = useThree((state) => state.camera);
  const groupRef = useRef<Group>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const objectPositionRef = useRef(new Vector3());
  const cameraPositionRef = useRef(new Vector3());
  const appliedScaleRef = useRef<number | null>(null);

  function updateScale(element: HTMLDivElement | null = elementRef.current) {
    const group = groupRef.current;
    if (element === null || group === null) return;

    camera.updateMatrixWorld();
    group.updateWorldMatrix(true, false);
    objectPositionRef.current.setFromMatrixPosition(group.matrixWorld);
    cameraPositionRef.current.setFromMatrixPosition(camera.matrixWorld);
    const scale = getCameraScaledHtmlScale(
      camera,
      objectPositionRef.current.distanceTo(cameraPositionRef.current),
      distanceFactor,
    );
    if (appliedScaleRef.current === scale) return;

    element.style.transform = `scale(${scale})`;
    appliedScaleRef.current = scale;
  }

  useFrame(() => updateScale());

  const htmlStyle: CSSProperties = {
    ...style,
    transformOrigin: "0 0",
  };

  return (
    <group ref={groupRef}>
      <Html
        {...htmlProps}
        ref={(element) => {
          elementRef.current = element;
          appliedScaleRef.current = null;
          updateScale(element);
        }}
        style={htmlStyle}
      >
        {children}
      </Html>
    </group>
  );
}
