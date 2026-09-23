import {
  getGetCompiledTrajectoryQueryKey,
  getGetProjectQueryKey,
  getListAnchorsQueryKey,
  getListChatMessagesQueryKey,
  getListProjectsQueryKey,
  getListScenePointsQueryKey,
  getGetTrajectoryQueryKey,
  getGetSpeedTimelineQueryKey,
  getGetAimTimelineQueryKey,
  getGetOrientationTimelineQueryKey,
  getGetDepthOfFieldTimelineQueryKey,
} from "@/shared/api/generated/client";

export const projectKeys = {
  all: ["/api/v1/projects"] as const,
  list: getListProjectsQueryKey,
  detail: getGetProjectQueryKey,
  anchors: getListAnchorsQueryKey,
  scenePoints: getListScenePointsQueryKey,
  segments: getGetTrajectoryQueryKey,
  speed: getGetSpeedTimelineQueryKey,
  aim: getGetAimTimelineQueryKey,
  orientation: getGetOrientationTimelineQueryKey,
  depthOfField: getGetDepthOfFieldTimelineQueryKey,
  chat: getListChatMessagesQueryKey,
  trajectory: getGetCompiledTrajectoryQueryKey,
};
