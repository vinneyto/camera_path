import type { GaussianCloudLoadProgress } from "./gaussian-cloud-load-progress";
import type { ThreeElement } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type { Object3D } from "three";

export type SceneSurfacePoint = [number, number, number];
export type SceneSurfaceBackground = readonly [number, number, number, number];

export interface SceneSurfaceBounds {
  center: SceneSurfacePoint;
  radius: number;
  min?: SceneSurfacePoint;
  max?: SceneSurfacePoint;
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
  onProgress?: (progress: GaussianCloudLoadProgress) => void;
  /** Initial pose for the first view-dependent cut, before the object mounts. */
  initialWorldMatrix?: readonly number[];
  onReady?: (surface: SceneSurfaceReady) => void;
  onSurfaceClick?: (hit: SceneSurfaceHit) => void;
  onSurfacePointerDown?: SceneSurfacePointerHandler;
  onSurfacePointerMove?: SceneSurfacePointerHandler;
  onSurfacePointerUp?: SceneSurfacePointerHandler;
  /** Controls R3F pointer events; the object remains available to scene raycasts. */
  raycastable?: boolean;
  /** Preload and report readiness without attaching the same Object3D twice. */
  renderObject?: boolean;
  /** Identifies a cloud transferred between placement preview and project scene. */
  resourceKey?: string;
  source: GaussianCloudSource;
}

export type GaussianCloudSource =
  | { kind: "url"; url: string; format?: "ply" | "sog" }
  | { buffer: ArrayBuffer; kind: "buffer"; name?: string };
