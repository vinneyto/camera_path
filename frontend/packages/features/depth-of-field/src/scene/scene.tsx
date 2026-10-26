"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { useCameraState, usePlaybackState } from "@camera-path/store";

import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { evaluateDepthOfFieldKeyframe } from "@camera-path/trajectory-math";
import { useLayoutEffect } from "react";
import { DepthOfField } from "./depth-of-field";
import { DepthOfFieldFocusHelper } from "./depth-of-field-focus-helper";
export function DepthOfFieldScene() {
  const trajectory = useCompiledTrajectoryResource().data?.data;
  const playback = usePlaybackState();
  const mode = useCameraState().cameraMode;
  const { depthSupported, radius, requestDepth } = useSceneServices();
  const keyframe = trajectory
    ? evaluateDepthOfFieldKeyframe(trajectory, playback.pathPosition)
    : null;
  const enabled = depthSupported && mode === "trajectory" && keyframe !== null;
  useLayoutEffect(() => {
    requestDepth("depth-of-field.scene", enabled);
    return () => requestDepth("depth-of-field.scene", false);
  }, [enabled, requestDepth]);
  if (!depthSupported || !keyframe || !trajectory?.position_segments.length)
    return null;
  return mode === "orbit" ? (
    radius !== null && (
      <DepthOfFieldFocusHelper
        fallbackRayLength={radius * 4}
        focus={keyframe.focus}
      />
    )
  ) : (
    <DepthOfField
      bokeh={keyframe.bokeh_scale}
      focalLength={Math.max((radius ?? 1) * keyframe.focus_range_scale, 0.001)}
      focus={keyframe.focus}
    />
  );
}
