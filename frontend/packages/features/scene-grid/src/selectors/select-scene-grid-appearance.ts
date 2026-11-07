import { SCENE_GRID_RENDER_ORDER, SCENE_GRID_THEME } from "../constants";

export function selectSceneGridAppearance({
  dark,
  webgpu,
}: {
  dark: boolean;
  webgpu: boolean;
}) {
  return {
    ...SCENE_GRID_THEME[dark ? "dark" : "light"],
    renderOrder: SCENE_GRID_RENDER_ORDER[webgpu ? "webgpu" : "webgl"],
  };
}
