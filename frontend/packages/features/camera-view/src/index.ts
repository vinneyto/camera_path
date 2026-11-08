import type { FeatureSlots } from "@camera-path/slots";
import { CameraViewScene } from "./scene/scene";
import { CameraViewToolbar } from "./ui/toolbar";
import { FreeFlightHint } from "./ui/free-flight-hint";

export const slots = {
  project: {
    scene: [CameraViewScene],
    toolbar: [CameraViewToolbar],
    hints: [FreeFlightHint],
  },
} as const satisfies FeatureSlots;
