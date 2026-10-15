import type { EditorStoreApi } from "@camera-path/store";
import type { LibraryAsset } from "@camera-path/types/api";
import type { CameraMode, EditorTool } from "@camera-path/types/editor-state";
import type { SceneObjectUpdate } from "@camera-path/types/scene-object-update";
/** Stable, ordinary Zustand actions, owned by the same project lifetime as the store. */
export function createEditorActions(store: EditorStoreApi) {
  const updateObject = (
    field: "hoveredObjectId" | "selectedObjectId",
    { id, ifCurrentId }: SceneObjectUpdate,
  ) =>
    store.setState((state) => {
      const current = state.sceneInteraction[field];
      if (
        (ifCurrentId !== undefined && current !== ifCurrentId) ||
        current === id
      )
        return state;
      return { sceneInteraction: { ...state.sceneInteraction, [field]: id } };
    });
  return {
    hoverObject: (input: SceneObjectUpdate) =>
      updateObject("hoveredObjectId", input),
    selectObject: (input: SceneObjectUpdate) =>
      updateObject("selectedObjectId", input),
    setCameraMode: (cameraMode: CameraMode) =>
      store.setState((state) => ({
        camera: { cameraMode },
        ...(cameraMode === "trajectory"
          ? {
              tool: { activeTool: null, pendingCloud: null },
              sceneInteraction: {
                ...state.sceneInteraction,
                hoveredObjectId: null,
              },
            }
          : {}),
      })),
    setActiveTool: (activeTool: EditorTool | null) =>
      store.setState((state) => ({
        tool: {
          activeTool,
          pendingCloud: activeTool === "cloud" ? state.tool.pendingCloud : null,
        },
      })),
    startCloudPlacement: (asset: LibraryAsset) =>
      store.setState((state) => ({
        camera: { cameraMode: "orbit" },
        tool: { activeTool: "cloud", pendingCloud: { ...asset } },
        sceneInteraction: { ...state.sceneInteraction, hoveredObjectId: null },
      })),
    resetPlayback: () =>
      store.setState({
        playback: { elapsed: 0, pathPosition: 0, playing: false },
      }),
    setPlaybackFrame: ({
      pathPosition,
      elapsed,
    }: {
      pathPosition: number;
      elapsed: number;
    }) =>
      store.setState((state) => ({
        playback: { ...state.playback, pathPosition, elapsed },
      })),
    setPlaying: (playing: boolean) =>
      store.setState((state) => ({ playback: { ...state.playback, playing } })),
  };
}
export type EditorActions = ReturnType<typeof createEditorActions>;
