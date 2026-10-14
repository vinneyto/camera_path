import type { CameraMode, EditorTool } from "@camera-path/contracts/host-state";
import type {
  useAnchorHeightEditing,
  useAnchorPlacement,
} from "@camera-path/feature-anchors";
import type { useCloudPlacementInteraction } from "@camera-path/feature-scene-models";
import type {
  GaussianRenderingBackend,
  SceneSurfaceReady,
} from "@camera-path/scene-runtime/surface";
import type { SceneContentsProps } from "@host/ui/scene-editor/ui/scene-contents";
export type SceneCompositionInputs = Pick<
  SceneContentsProps,
  | "lidar"
  | "trajectory"
  | "clouds"
  | "dark"
  | "anchors"
  | "onOpenAnchorMenu"
  | "onOpenTrajectoryMenu"
  | "onSelectTrajectory"
  | "selected"
> & {
  trajectoryAvailable: boolean;
  editorVisible: boolean;
  activeTool: EditorTool | null;
  canEdit: boolean;
  showGrid: boolean;
  cameraMode: CameraMode;
  renderingBackend: GaussianRenderingBackend;
  placement: ReturnType<typeof useAnchorPlacement>;
  heightEditing: ReturnType<typeof useAnchorHeightEditing>;
  cloudPlacement: ReturnType<typeof useCloudPlacementInteraction>;
  orderedAnchors: SceneContentsProps["anchors"];
  handleSurfaceReady: (id: string, surface: SceneSurfaceReady) => void;
  handleSurfaceError: (id: string, error: Error) => void;
  handleSurfaceLoading: (id: string) => void;
};
