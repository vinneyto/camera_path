import type { ThreeElement } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type { Object3D } from "three";

export type SceneSurfacePoint = [number, number, number];
export type SceneSurfaceBackground = readonly [number, number, number, number];

export interface SceneSurfaceBounds {
  center: SceneSurfacePoint;
  radius: number;
}

export interface SceneSurfaceHit {
  normal: SceneSurfacePoint;
  position: SceneSurfacePoint;
}

export interface SceneSurfaceReady {
  bounds: SceneSurfaceBounds;
}

export type SceneSurfacePointerHandler = (
  hit: SceneSurfaceHit,
  event: ThreeEvent<PointerEvent>,
) => void;

export interface SceneSurfaceProps extends Omit<
  ThreeElement<typeof Object3D>,
  "args" | "dispose"
> {
  onError?: (error: Error) => void;
  onLoading?: () => void;
  onReady?: (surface: SceneSurfaceReady) => void;
  onSurfaceClick?: (hit: SceneSurfaceHit) => void;
  onSurfacePointerDown?: SceneSurfacePointerHandler;
  onSurfacePointerMove?: SceneSurfacePointerHandler;
  onSurfacePointerUp?: SceneSurfacePointerHandler;
  raycastable?: boolean;
  source: GaussianCloudSource;
}

export type GaussianCloudSource =
  | { kind: "url"; url: string }
  | { buffer: ArrayBuffer; kind: "buffer"; name?: string };
