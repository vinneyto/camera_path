import * as data from "@camera-path/contracts/host-data";
import * as requests from "@camera-path/contracts/host-requests";
import { HostProvider } from "@camera-path/extension-api/host-provider";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import {
  EditorStoreProvider,
  useEditorStore,
  useEditorStoreApi,
} from "@host/editor/model/editor-store-provider";
import { useBindRequest } from "@host/runtime/use-bind-request";
import { useBindValue } from "@host/runtime/use-bind-value";
import { useRuntimeLifecycle } from "@host/runtime/use-runtime-lifecycle";
import { useState, type ReactNode } from "react";
function Bindings({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new HostRuntime("project", "project"));
  useRuntimeLifecycle(runtime);
  const store = useEditorStoreApi();
  const tool = useEditorStore((s) => s.tool);
  const camera = useEditorStore((s) => s.camera.cameraMode);
  const playback = useEditorStore((s) => s.playback);
  useBindValue(runtime, data.projectPermissions, { canEdit: true });
  useBindValue(runtime, data.editorTool, tool);
  const interaction = useEditorStore((s) => s.sceneInteraction);
  useBindValue(runtime, data.sceneInteraction, interaction);
  useBindRequest(runtime, requests.hoverObject, (input) =>
    store.getState().sceneInteractionActions.hoverObject(input),
  );
  useBindRequest(runtime, requests.selectObject, (input) =>
    store.getState().sceneInteractionActions.selectObject(input),
  );
  useBindValue(runtime, data.cameraMode, camera);
  useBindValue(runtime, data.playbackState, playback);
  useBindRequest(runtime, requests.setActiveTool, (v) =>
    store.getState().toolActions.setActiveTool(v),
  );
  useBindRequest(runtime, requests.startCloudPlacement, (v) =>
    store.getState().toolActions.startCloudPlacement(v),
  );
  useBindRequest(runtime, requests.resetPlayback, () =>
    store.getState().playbackActions.resetPlayback(),
  );
  useBindRequest(runtime, requests.setPlaybackFrame, (v) =>
    store
      .getState()
      .playbackActions.setPlaybackFrame(v.pathPosition, v.elapsed),
  );
  useBindRequest(runtime, requests.setPlaying, (v) =>
    store.getState().playbackActions.setPlaying(v),
  );
  return <HostProvider runtime={runtime}>{children}</HostProvider>;
}
export function EditorTestHost({ children }: { children: ReactNode }) {
  return (
    <EditorStoreProvider>
      <Bindings>{children}</Bindings>
    </EditorStoreProvider>
  );
}
