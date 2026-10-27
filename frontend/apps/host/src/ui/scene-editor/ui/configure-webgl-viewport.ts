import type { RootState } from "@react-three/fiber";
import {
  configureInteractiveRaycasterLayers,
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
} from "@camera-path/render-pipeline";

export function configureWebGlViewport({
  camera,
  raycaster,
}: Pick<RootState, "camera" | "raycaster">) {
  // WebGPU renders these layers in separate passes; WebGL draws one scene.
  camera.layers.enable(RENDER_PIPELINE_OVERLAY_LAYER);
  camera.layers.enable(RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER);
  configureInteractiveRaycasterLayers(raycaster);
}
