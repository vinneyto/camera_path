import { SCENE_LIGHT_INTENSITY } from "../constants";

export function selectSceneLighting(dark: boolean) {
  return SCENE_LIGHT_INTENSITY[dark ? "dark" : "light"];
}
