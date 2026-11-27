import type { SceneObjectTransform } from "@camera-path/types/scene-object-transform";
import type { SceneWidgetMode } from "@camera-path/types/editor-state";
import type { Matrix4, Quaternion } from "three";

export interface WidgetPose {
  transform: SceneObjectTransform;
  parentMatrix: Matrix4;
  parentRotation: Quaternion;
}
export interface WidgetOptions extends WidgetPose {
  mode: SceneWidgetMode;
  enabled: boolean;
}
export interface WidgetCallbacks {
  onStart: () => void;
  onChange: (transform: SceneObjectTransform) => void;
  onCommit: (transform: SceneObjectTransform) => void;
  onCancel: () => void;
}
