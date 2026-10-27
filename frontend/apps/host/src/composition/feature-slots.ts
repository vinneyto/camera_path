import { slots as anchorsSlots } from "@camera-path/feature-anchors";
import { slots as appearanceSlots } from "@camera-path/feature-appearance";
import { slots as cameraAimSlots } from "@camera-path/feature-camera-aim";
import { slots as cameraOrientationSlots } from "@camera-path/feature-camera-orientation";
import { slots as cameraViewSlots } from "@camera-path/feature-camera-view";
import { slots as chatAgentSlots } from "@camera-path/feature-chat-agent";
import { slots as depthOfFieldSlots } from "@camera-path/feature-depth-of-field";
import { slots as identitySlots } from "@camera-path/feature-identity";
import { slots as librarySlots } from "@camera-path/feature-library";
import { slots as lidarSlots } from "@camera-path/feature-lidar";
import { slots as playbackSlots } from "@camera-path/feature-playback";
import { slots as projectsSlots } from "@camera-path/feature-projects";
import { slots as rendererPreferencesSlots } from "@camera-path/feature-renderer-preferences";
import { slots as sceneGridSlots } from "@camera-path/feature-scene-grid";
import { slots as sceneModelsSlots } from "@camera-path/feature-scene-models";
import { slots as speedTrackSlots } from "@camera-path/feature-speed-track";
import { slots as trajectorySlots } from "@camera-path/feature-trajectory";
import { slots as siftSlots } from "@camera-path/feature-sift";
import type { FeatureSlots } from "@camera-path/slots";

/** Catalog order, followed by local component order, defines each slot's order. */
export const featureSlots = [
  rendererPreferencesSlots,
  appearanceSlots,
  identitySlots,
  cameraViewSlots,
  sceneGridSlots,
  sceneModelsSlots,
  anchorsSlots,
  trajectorySlots,
  speedTrackSlots,
  cameraAimSlots,
  cameraOrientationSlots,
  depthOfFieldSlots,
  lidarSlots,
  playbackSlots,
  chatAgentSlots,
  projectsSlots,
  librarySlots,
  siftSlots,
] as const satisfies readonly FeatureSlots[];
