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

export interface SceneSurfaceProps {
  name?: string;
  onClick?: (hit: SceneSurfaceHit) => void;
  onError?: (error: Error) => void;
  onLoading?: () => void;
  onReady?: (surface: SceneSurfaceReady) => void;
  source: GaussianCloudSource;
}

export type GaussianCloudSource =
  | { kind: "url"; url: string }
  | { buffer: ArrayBuffer; kind: "buffer"; name?: string };
