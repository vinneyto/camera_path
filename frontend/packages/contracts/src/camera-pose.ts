export interface TrajectoryCameraPose {
  readonly position: readonly [number, number, number];
  readonly orientation: readonly [number, number, number, number];
  readonly up: readonly [number, number, number];
  /**
   * @asType integer
   * @minimum 0
   */
  readonly frameId: number;
  /**
   * @asType integer
   * @minimum 0
   */
  readonly projectRevision: number;
}
