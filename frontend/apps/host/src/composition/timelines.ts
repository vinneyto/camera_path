import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import { ContributionRegistry } from "@camera-path/extension-api/contribution-registry";
import * as f1 from "@camera-path/feature-camera-aim";
import * as f2 from "@camera-path/feature-camera-orientation";
import * as f3 from "@camera-path/feature-depth-of-field";
import * as f4 from "@camera-path/feature-lidar";
import * as f0 from "@camera-path/feature-speed-track";
import { bindTimeline } from "./bind-timeline";
import type { TimelineInputs } from "./timeline-inputs";
const registry = new ContributionRegistry<
  TimelineContribution<TimelineInputs>
>();
registry.register(
  f0.manifest,
  f0.timelineContribution.id,
  bindTimeline(f0.timelineContribution, (i) => ({
    trajectory: { motion_profile: i.trajectory.motion_profile },
    pathPosition: i.pathPosition,
    deletingKeyframeId: i.deletingSpeedKeyframeId,
    onDeleteKeyframe: i.onDeleteSpeedKeyframe,
  })),
);
registry.register(
  f1.manifest,
  f1.timelineContribution.id,
  bindTimeline(f1.timelineContribution, (i) => ({
    project: { scene_points: i.project.scene_points },
    trajectory: {
      camera_track: {
        default_aim: i.trajectory.camera_track.default_aim,
        keyframes: i.trajectory.camera_track.keyframes,
      },
    },
    deletingKeyframeId: i.deletingAimKeyframeId,
    onDeleteKeyframe: i.onDeleteAimKeyframe,
  })),
);
registry.register(
  f2.manifest,
  f2.timelineContribution.id,
  bindTimeline(f2.timelineContribution, (i) => ({
    trajectory: {
      camera_track: {
        orientation_keyframes: i.trajectory.camera_track.orientation_keyframes,
      },
    },
    deletingKeyframeId: i.deletingOrientationKeyframeId,
    onDeleteKeyframe: i.onDeleteOrientationKeyframe,
  })),
);
registry.register(
  f3.manifest,
  f3.timelineContribution.id,
  bindTimeline(f3.timelineContribution, (i) => ({
    project: { scene_points: i.project.scene_points },
    trajectory: {
      camera_track: {
        depth_of_field_keyframes:
          i.trajectory.camera_track.depth_of_field_keyframes,
      },
    },
    deletingKeyframeId: i.deletingDepthOfFieldKeyframeId,
    onDeleteKeyframe: i.onDeleteDepthOfFieldKeyframe,
    pending: i.effectsPending,
    onAdd: i.onAddDepthOfField,
  })),
);
registry.register(
  f4.manifest,
  f4.timelineContribution.id,
  bindTimeline(f4.timelineContribution, (i) => ({
    keyframe: i.project.camera_track.lidar_keyframe ?? null,
    onSet: i.onSetLidar,
    pending: i.lidarPending,
  })),
);
export const timelineContributions = registry.list("timeline.tracks");
