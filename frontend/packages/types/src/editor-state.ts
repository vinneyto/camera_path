import type { LibraryAsset } from "./api";
import type { PathPosition } from "./path-position";
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
  readonly pathPosition: PathPosition;
  readonly playing: boolean;
}
