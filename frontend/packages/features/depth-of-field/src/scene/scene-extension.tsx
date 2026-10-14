"use client";
import {
  compiledTrajectory,
  playbackState,
  cameraMode,
} from "@camera-path/contracts/host-data";
import { useData, useDataQuery } from "@camera-path/extension-api";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { evaluateDepthOfFieldKeyframe } from "@camera-path/trajectory-math";
import { useLayoutEffect } from "react";
import { manifest } from "../manifest";
import { DepthOfField } from "./depth-of-field";
import { DepthOfFieldFocusHelper } from "./depth-of-field-focus-helper";
export function SceneExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory).data?.data;
  const playback = useData(manifest, playbackState);
  const mode = useData(manifest, cameraMode);
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
