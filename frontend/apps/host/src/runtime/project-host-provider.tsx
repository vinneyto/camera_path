"use client";
import {
  createPlaybackTable,
  timeAtPathPosition,
} from "@camera-path/trajectory-math";
import { ExtensionProvider } from "@camera-path/extension-api/extension-provider";
import { ExtensionSlot } from "@camera-path/extension-api/extension-slot";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import { anchorObjectId } from "@camera-path/contracts/anchor-object-id";
import { projectFeatures } from "@host/composition/project-features";
import { useActivateFeatures } from "./use-activate-features";

import * as data from "@camera-path/contracts/host-data";
import * as requests from "@camera-path/contracts/host-requests";
import {
  HostProvider,
  useHostRuntime,
} from "@camera-path/extension-api/host-provider";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import * as api from "@host/adapters/api/generated/client";
import * as deletions from "@host/adapters/deletions";
import { useAddAnchor } from "@host/adapters/features/anchors/use-add-anchor";
import { useUpdateAnchor } from "@host/adapters/features/anchors/use-update-anchor";
import { useAddCameraOrientationKeyframe } from "@host/adapters/features/camera-orientation/use-add-camera-orientation-keyframe";
import { useUpdateCameraOrientationKeyframe } from "@host/adapters/features/camera-orientation/use-update-camera-orientation-keyframe";
import { useUpdateDefaultCameraOrientation } from "@host/adapters/features/camera-orientation/use-update-default-camera-orientation";
import { useSendChatMessage } from "@host/adapters/features/chat-agent/use-send-chat-message";
import { useAddDepthOfFieldKeyframe } from "@host/adapters/features/depth-of-field/use-add-depth-of-field-keyframe";
import { useLidarTimeline } from "@host/adapters/features/lidar/use-lidar-timeline";
import { useProjectCloudActions } from "@host/adapters/features/scene-models/use-project-cloud-actions";
import {
  useEditorStore,
  useEditorStoreApi,
} from "@host/editor/model/editor-store-provider";
import { useState, type ReactNode } from "react";
import { useBindQuery } from "./use-bind-query";
import { useBindRequest } from "./use-bind-request";
import { useBindValue } from "./use-bind-value";
import { useRuntimeLifecycle } from "./use-runtime-lifecycle";
export function ProjectHostProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const parent = useHostRuntime();
  const [runtime] = useState(
    () => new HostRuntime(projectId, "project", parent),
  );
  useRuntimeLifecycle(runtime);
  const store = useEditorStoreApi();
  const tool = useEditorStore((s) => s.tool);
  const camera = useEditorStore((s) => s.camera.cameraMode);
  const playback = useEditorStore((s) => s.playback);
  const interaction = useEditorStore((s) => s.sceneInteraction);
  useBindValue(runtime, data.editorTool, tool);
  useBindValue(runtime, data.cameraMode, camera);
  useBindValue(runtime, data.playbackState, playback);
  useBindValue(runtime, data.sceneInteraction, interaction);
  useBindQuery(runtime, data.sceneModels, api.useListProjectClouds(projectId));
  useBindQuery(runtime, data.anchors, api.useListAnchors(projectId));
  useBindQuery(runtime, data.scenePoints, api.useListScenePoints(projectId));
  useBindQuery(
    runtime,
    data.trajectoryGeometry,
    api.useGetTrajectory(projectId),
  );
  useBindQuery(runtime, data.speedTimeline, api.useGetSpeedTimeline(projectId));
  useBindQuery(runtime, data.aimTimeline, api.useGetAimTimeline(projectId));
  useBindQuery(
    runtime,
    data.orientationTimeline,
    api.useGetOrientationTimeline(projectId),
  );
  useBindQuery(
    runtime,
    data.depthOfFieldTimeline,
    api.useGetDepthOfFieldTimeline(projectId),
  );
  useBindQuery(runtime, data.lidarTimeline, api.useGetLidarTimeline(projectId));
  useBindQuery(runtime, data.chatHistory, api.useListChatMessages(projectId));
  const compiled = api.useGetCompiledTrajectory(projectId);
  useBindQuery(runtime, data.compiledTrajectory, compiled);
  useBindRequest(runtime, requests.seekPlayback, (position) => {
    const trajectory =
      compiled.data?.status === 200
        ? data.compiledTrajectory.schema.parse(compiled.data.data)
        : null;
    const table = trajectory ? createPlaybackTable(trajectory) : [];
    store
      .getState()
      .playbackActions.setPlaybackFrame(
        position,
        timeAtPathPosition(table, position),
      );
  });
  const addAnchorMutation = useAddAnchor(projectId);
  useBindRequest(runtime, requests.addAnchor, async (input) => {
    await addAnchorMutation.mutateAsync(input);
  });
  const updateAnchorMutation = useUpdateAnchor(projectId);
  useBindRequest(runtime, requests.updateAnchor, async (input) => {
    await updateAnchorMutation.mutateAsync(input);
  });
  const addCameraOrientationKeyframeMutation =
    useAddCameraOrientationKeyframe(projectId);
  useBindRequest(
    runtime,
    requests.addCameraOrientationKeyframe,
    async (input) => {
      await addCameraOrientationKeyframeMutation.mutateAsync(input);
    },
  );
  const updateCameraOrientationKeyframeMutation =
    useUpdateCameraOrientationKeyframe(projectId);
  useBindRequest(
    runtime,
    requests.updateCameraOrientationKeyframe,
    async (input) => {
      await updateCameraOrientationKeyframeMutation.mutateAsync(input);
    },
  );
  const updateDefaultCameraOrientationMutation =
    useUpdateDefaultCameraOrientation(projectId);
  useBindRequest(
    runtime,
    requests.updateDefaultCameraOrientation,
    async (input) => {
      await updateDefaultCameraOrientationMutation.mutateAsync({
        pitch_deg: input.pitch_deg ?? 0,
        yaw_deg: input.yaw_deg ?? 0,
        roll_deg: input.roll_deg ?? 0,
      });
    },
  );
  const addDepthOfFieldKeyframeMutation = useAddDepthOfFieldKeyframe(projectId);
  useBindRequest(runtime, requests.addDepthOfFieldKeyframe, async (input) => {
    await addDepthOfFieldKeyframeMutation.mutateAsync(input);
  });
  const projectCloudActionMutation = useProjectCloudActions(projectId);
  useBindRequest(runtime, requests.projectCloudAction, async (input) => {
    const response = await projectCloudActionMutation.mutateAsync(input);
    return { status: response.status };
  });
  const setLidarTimelineMutation = useLidarTimeline(projectId);
  useBindRequest(runtime, requests.setLidarTimeline, async (input) => {
    await setLidarTimelineMutation.mutateAsync(input);
  });
  const sendChatMessageMutation = useSendChatMessage(projectId);
  useBindRequest(runtime, requests.sendChatMessage, async (input, signal) => {
    const response = await sendChatMessageMutation.mutateAsync({
      ...input,
      onAccepted: () => {
        if (!signal.aborted) input.onAccepted();
      },
    });
    if (!signal.aborted && response.compiled.position_segments.length)
      store
        .getState()
        .sceneInteractionActions.selectObject({ id: trajectoryObjectId });
    return response;
  });
  const deleteAnchorMutation = deletions.useDeleteAnchor(projectId);
  useBindRequest(runtime, requests.deleteAnchor, async (input, signal) => {
    await deleteAnchorMutation.mutateAsync(input);
    if (!signal.aborted) {
      const id = anchorObjectId(input);
      store
        .getState()
        .sceneInteractionActions.hoverObject({ id: null, ifCurrentId: id });
      store
        .getState()
        .sceneInteractionActions.selectObject({ id: null, ifCurrentId: id });
    }
  });
  const deleteSpeedKeyframeMutation =
    deletions.useDeleteSpeedKeyframe(projectId);
  useBindRequest(runtime, requests.deleteSpeedKeyframe, async (input) => {
    await deleteSpeedKeyframeMutation.mutateAsync(input);
  });
  const deleteCameraKeyframeMutation =
    deletions.useDeleteCameraKeyframe(projectId);
  useBindRequest(runtime, requests.deleteCameraKeyframe, async (input) => {
    await deleteCameraKeyframeMutation.mutateAsync(input);
  });
  const deleteCameraOrientationKeyframeMutation =
    deletions.useDeleteCameraOrientationKeyframe(projectId);
  useBindRequest(
    runtime,
    requests.deleteCameraOrientationKeyframe,
    async (input) => {
      await deleteCameraOrientationKeyframeMutation.mutateAsync(input);
    },
  );
  const deleteDepthOfFieldKeyframeMutation =
    deletions.useDeleteDepthOfFieldKeyframe(projectId);
  useBindRequest(
    runtime,
    requests.deleteDepthOfFieldKeyframe,
    async (input) => {
      await deleteDepthOfFieldKeyframeMutation.mutateAsync(input);
    },
  );
  const clearTrajectoryMutation = deletions.useClearTrajectory(projectId);
  useBindRequest(runtime, requests.clearTrajectory, async (input, signal) => {
    await clearTrajectoryMutation.mutateAsync(input);
    if (!signal.aborted) {
      store.getState().sceneInteractionActions.selectObject({
        id: null,
        ifCurrentId: trajectoryObjectId,
      });
      store.getState().sceneInteractionActions.hoverObject({
        id: null,
        ifCurrentId: trajectoryObjectId,
      });
      store.getState().playbackActions.resetPlayback();
    }
  });
  useBindRequest(runtime, requests.setActiveTool, (input) =>
    store.getState().toolActions.setActiveTool(input),
  );
  useBindRequest(runtime, requests.startCloudPlacement, (input) =>
    store.getState().toolActions.startCloudPlacement(input),
  );
  useBindRequest(runtime, requests.hoverObject, (input) =>
    store.getState().sceneInteractionActions.hoverObject(input),
  );
  useBindRequest(runtime, requests.selectObject, (input) =>
    store.getState().sceneInteractionActions.selectObject(input),
  );
  useBindRequest(runtime, requests.setCameraMode, (mode) =>
    store.getState().cameraActions.setCameraMode(mode),
  );
  useBindRequest(runtime, requests.resetPlayback, () =>
    store.getState().playbackActions.resetPlayback(),
  );
  useBindRequest(runtime, requests.setPlaying, (input) =>
    store.getState().playbackActions.setPlaying(input),
  );
  useBindRequest(
    runtime,
    requests.setPlaybackFrame,
    ({ pathPosition, elapsed }) =>
      store.getState().playbackActions.setPlaybackFrame(pathPosition, elapsed),
  );
  useActivateFeatures(runtime, projectFeatures);
  return (
    <HostProvider runtime={runtime}>
      <ExtensionProvider extensions={projectFeatures}>
        <ExtensionSlot name="project.root" />
        {children}
      </ExtensionProvider>
    </HostProvider>
  );
}
