export interface TrajectoryCameraPose {
  readonly position: readonly [number, number, number];
  readonly orientation: readonly [number, number, number, number];
  readonly up: readonly [number, number, number];
  readonly frameId: number;
  readonly projectRevision: number;
}
