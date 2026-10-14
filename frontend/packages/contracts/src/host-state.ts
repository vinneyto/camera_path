import type { ChallengeResponse, LibraryAsset } from "./api";
export type Theme = "light" | "dark";
export type EditorTool = "anchor" | "anchor-height" | "cloud";
export type CameraMode = "orbit" | "trajectory";
export interface ToolState {
  readonly activeTool: EditorTool | null;
  readonly pendingCloud: LibraryAsset | null;
}
export interface PlaybackState {
  /** @minimum 0 */
  readonly elapsed: number;
  /**
   * @minimum 0
   * @maximum 1
   */
  readonly pathPosition: number;
  readonly playing: boolean;
}
export interface IdentityState {
  readonly canEdit: boolean;
  readonly loading: boolean;
  readonly username: string | null;
  readonly errorMessage: string | null;
  readonly pending: boolean;
  readonly challenge: ChallengeResponse | null;
}
export interface PreferencesState {
  readonly webGpuTileRenderer: boolean;
  readonly showGrid: boolean;
  readonly gaussianDpr: "1x" | "system";
  readonly loading: boolean;
  readonly saving: boolean;
  readonly ready: boolean;
  readonly errorMessage: string | null;
}
