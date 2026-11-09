import type { EditorStoreApi } from "@camera-path/store";
import type { LibraryAsset } from "@camera-path/types/api";
import type {
  CameraMode,
  EditorTool,
  SceneWidgetMode,
} from "@camera-path/types/editor-state";
import type { SceneObjectUpdate } from "@camera-path/types/scene-object-update";
import { appendChatReference } from "./append-chat-reference";
/** Stable, ordinary Zustand actions, owned by the same project lifetime as the store. */
export function createEditorActions(store: EditorStoreApi) {
  const updateObject = (
    field: "hoveredObjectId" | "selectedObjectId",
    { id, ifCurrentId, name }: SceneObjectUpdate & { name?: string },
  ) =>
    store.setState((state) => {
      const current = state.sceneInteraction[field];
      if (
        (ifCurrentId !== undefined && current !== ifCurrentId) ||
        current === id
      )
        return state;
      return {
        sceneInteraction: { ...state.sceneInteraction, [field]: id },
        ...(field === "selectedObjectId" && id && name
          ? {
              chatComposer: {
                message: appendChatReference(state.chatComposer.message, name),
              },
            }
          : {}),
      };
    });
  return {
    changeChatMessage: (message: string) =>
      store.setState({ chatComposer: { message } }),
    acceptChatMessage: (submitted: string) =>
      store.setState((state) =>
        state.chatComposer.message === submitted
          ? { chatComposer: { message: "" } }
          : state,
      ),
    referenceChatObject: (name: string) =>
      store.setState((state) => ({
        chatComposer: {
          message: appendChatReference(state.chatComposer.message, name),
        },
      })),
    clearRemovedSceneObjects: (ids: readonly string[]) => {
      const removed = new Set(ids);
      store.setState((state) => {
        const interaction = state.sceneInteraction;
        const clearHover =
          interaction.hoveredObjectId !== null &&
          removed.has(interaction.hoveredObjectId);
        const clearSelection =
          interaction.selectedObjectId !== null &&
          removed.has(interaction.selectedObjectId);
        if (!clearHover && !clearSelection) return state;
        return {
          sceneInteraction: {
            ...interaction,
            ...(clearHover ? { hoveredObjectId: null } : {}),
            ...(clearSelection ? { selectedObjectId: null } : {}),
          },
        };
      });
    },
    finishObjectTransform: () =>
      store.setState((state) =>
        state.tool.activeTool === "object-transform"
          ? { tool: { ...state.tool, activeTool: null } }
          : state,
      ),
    setSceneWidget: (widget: SceneWidgetMode) =>
      store.setState((state) => ({
        sceneInteraction: { ...state.sceneInteraction, widget },
      })),
    hoverObject: (input: SceneObjectUpdate) =>
      updateObject("hoveredObjectId", input),
    selectObject: (input: SceneObjectUpdate & { name?: string }) =>
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
