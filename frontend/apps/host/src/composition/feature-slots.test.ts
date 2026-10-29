import type { FeatureSlots } from "@camera-path/slots";
import { expect, it } from "vitest";
import { featureSlots } from "./feature-slots";
it("preserves scene, timeline, settings and header order from the previous host composition", () => {
  const features: readonly FeatureSlots[] = featureSlots;
  expect(
    features.flatMap((f) => f.project?.scene ?? []).map((c) => c.name),
  ).toEqual([
    "CameraViewScene",
    "SceneGrid",
    "SceneModels",
    "AnchorsScene",
    "TrajectoryScene",
    "DepthOfFieldScene",
    "LidarScene",
  ]);
  expect(
    features.flatMap((f) => f.timeline?.tracks ?? []).map((c) => c.name),
  ).toEqual([
    "SpeedTimeline",
    "CameraAimTimeline",
    "CameraOrientationTimeline",
    "DepthOfFieldTimeline",
    "LidarTimeline",
  ]);
  expect(
    features.flatMap((f) => f.project?.commands ?? []).map((c) => c.name),
  ).toEqual([
    "AddCloudCommand",
    "RemoveCloudCommand",
    "RemoveTrajectoryCommand",
    "RemoveSpeedCommand",
    "RemoveAimCommand",
    "RemoveOrientationCommand",
    "AddDepthOfFieldCommand",
    "RemoveDepthOfFieldCommand",
    "AddLidarCommand",
    "RemoveLidarCommand",
  ]);
  expect(
    features.flatMap((f) => f.settings?.content ?? []).map((c) => c.name),
  ).toEqual(["RendererSettings", "GridSettings"]);
  expect(
    features.flatMap((f) => f.profile?.account ?? []).map((c) => c.name),
  ).toEqual(["ProfileControl"]);
  expect(
    features.flatMap((f) => f.navigation?.controls ?? []).map((c) => c.name),
  ).toEqual(["ThemeToggle"]);
});
