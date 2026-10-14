import type * as Api from "./api";
import type { TrajectoryCameraPose } from "./camera-pose";
import type { ProjectPermissions } from "./host-data/project-permissions";
import type { SceneInteractionState } from "./host-data/scene-interaction";
import type { SceneObjectUpdate } from "./scene-object-update";
import type {
  CameraMode,
  EditorTool,
  IdentityState,
  PlaybackState,
  PreferencesState,
  Theme,
  ToolState,
} from "./host-state";
import type { CloudAction } from "./host-requests/cloud-action";
import type { LoginInput } from "./host-requests/login";
import type { CloudActionResult } from "./host-requests/project-cloud-action";
import type { PlaybackFrameInput } from "./host-requests/set-playback-frame";
import type { UpdateAnchorInput } from "./host-requests/update-anchor";
import type { UpdateCameraOrientationKeyframeInput } from "./host-requests/update-camera-orientation-keyframe";
import type { UpdateLibraryDefaultsInput } from "./host-requests/update-library-defaults";

// Only serializable frontend DTOs belong here. API DTOs keep their OpenAPI schemas.
export interface HostSchemaTypes {
  projectPermissions: ProjectPermissions;
  identityState: IdentityState;
  preferencesState: PreferencesState;
  themeState: Theme;
  editorTool: ToolState;
  cameraMode: CameraMode;
  playbackState: PlaybackState;
  sceneInteraction: SceneInteractionState;
  hoverObject: SceneObjectUpdate;
  selectObject: SceneObjectUpdate;
  projectsCatalog: Api.ProjectMetadata[];
  libraryCatalog: Api.LibraryAsset[];
  sceneModels: Api.ProjectCloud[];
  anchors: Api.Anchor[];
  scenePoints: Api.ScenePoint[];
  chatHistory: Api.ChatHistoryMessage[];
  trajectoryCameraPose: TrajectoryCameraPose | null;
  updateAnchor: UpdateAnchorInput;
  updateCameraOrientationKeyframe: UpdateCameraOrientationKeyframeInput;
  setLidarTimeline: Api.LidarSettings | null;
  projectCloudAction: CloudAction;
  projectCloudActionResult: CloudActionResult;
  deleteLibraryAssets: string[];
  updateLibraryDefaults: UpdateLibraryDefaultsInput;
  login: LoginInput;
  setActiveTool: EditorTool | null;
  setCameraMode: CameraMode;
  setPlaybackFrame: PlaybackFrameInput;
}
