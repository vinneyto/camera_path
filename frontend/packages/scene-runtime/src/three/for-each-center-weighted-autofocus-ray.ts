import type { Camera, Raycaster, Vector2, Vector3 } from "three";

import {
  CENTER_WEIGHTED_AUTOFOCUS_PATTERN,
  type AutofocusRaySample,
} from "@camera-path/scene-runtime/three/center-weighted-autofocus-pattern";
import { getCameraForwardNdc } from "@camera-path/scene-runtime/three/get-camera-forward-ndc";

interface AutofocusRayScratch {
  pointer: Vector2;
  principalPoint: Vector3;
}

export function forEachCenterWeightedAutofocusRay(
  camera: Camera,
  raycaster: Raycaster,
  scratch: AutofocusRayScratch,
  visit: (
    raycaster: Raycaster,
    sample: AutofocusRaySample,
    index: number,
  ) => void,
) {
  const principalPoint = getCameraForwardNdc(camera, scratch.principalPoint);
  CENTER_WEIGHTED_AUTOFOCUS_PATTERN.forEach((sample, index) => {
    scratch.pointer.set(
      principalPoint.x + sample.x,
      principalPoint.y + sample.y,
    );
    raycaster.setFromCamera(scratch.pointer, camera);
    visit(raycaster, sample, index);
  });
}
