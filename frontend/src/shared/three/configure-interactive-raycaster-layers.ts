import type { Raycaster } from "three";

import {
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_SCENE_LAYER,
} from "./render-pipeline-scene-layers";

export function configureInteractiveRaycasterLayers(raycaster: Raycaster) {
  raycaster.layers.disableAll();
  raycaster.layers.enable(RENDER_PIPELINE_SCENE_LAYER);
  raycaster.layers.enable(RENDER_PIPELINE_OVERLAY_LAYER);
}
