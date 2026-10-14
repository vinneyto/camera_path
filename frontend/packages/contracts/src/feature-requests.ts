import { defineRequest } from "./define-request";
import * as host from "./host-requests";
export const camera_aim_deleteCameraKeyframe = defineRequest(
  "camera-aim.deleteCameraKeyframe@1",
  host.deleteCameraKeyframe.inputSchema,
  host.deleteCameraKeyframe.outputSchema,
  host.deleteCameraKeyframe.requiresEdit,
);
export const renderer_preferences_savePreferences = defineRequest(
  "renderer-preferences.savePreferences@1",
  host.savePreferences.inputSchema,
  host.savePreferences.outputSchema,
  host.savePreferences.requiresEdit,
);
export const renderer_preferences_retryPreferences = defineRequest(
  "renderer-preferences.retryPreferences@1",
  host.retryPreferences.inputSchema,
  host.retryPreferences.outputSchema,
  host.retryPreferences.requiresEdit,
);
export const speed_track_deleteSpeedKeyframe = defineRequest(
  "speed-track.deleteSpeedKeyframe@1",
  host.deleteSpeedKeyframe.inputSchema,
  host.deleteSpeedKeyframe.outputSchema,
  host.deleteSpeedKeyframe.requiresEdit,
);
export const lidar_setLidarTimeline = defineRequest(
  "lidar.setLidarTimeline@1",
  host.setLidarTimeline.inputSchema,
  host.setLidarTimeline.outputSchema,
  host.setLidarTimeline.requiresEdit,
);
export const library_uploadLibraryFile = defineRequest(
  "library.uploadLibraryFile@1",
  host.uploadLibraryFile.inputSchema,
  host.uploadLibraryFile.outputSchema,
  host.uploadLibraryFile.requiresEdit,
);
export const library_deleteLibraryAssets = defineRequest(
  "library.deleteLibraryAssets@1",
  host.deleteLibraryAssets.inputSchema,
  host.deleteLibraryAssets.outputSchema,
  host.deleteLibraryAssets.requiresEdit,
);
export const library_updateLibraryDefaults = defineRequest(
  "library.updateLibraryDefaults@1",
  host.updateLibraryDefaults.inputSchema,
  host.updateLibraryDefaults.outputSchema,
  host.updateLibraryDefaults.requiresEdit,
);
export const library_navigate = defineRequest(
  "library.navigate@1",
  host.navigate.inputSchema,
  host.navigate.outputSchema,
  host.navigate.requiresEdit,
);
export const chat_agent_sendChatMessage = defineRequest(
  "chat-agent.sendChatMessage@1",
  host.sendChatMessage.inputSchema,
  host.sendChatMessage.outputSchema,
  host.sendChatMessage.requiresEdit,
);
export const trajectory_clearTrajectory = defineRequest(
  "trajectory.clearTrajectory@1",
  host.clearTrajectory.inputSchema,
  host.clearTrajectory.outputSchema,
  host.clearTrajectory.requiresEdit,
);
export const trajectory_hoverTrajectory = defineRequest(
  "trajectory.hoverTrajectory@1",
  host.hoverTrajectory.inputSchema,
  host.hoverTrajectory.outputSchema,
  host.hoverTrajectory.requiresEdit,
);
export const trajectory_clearHoveredTrajectory = defineRequest(
  "trajectory.clearHoveredTrajectory@1",
  host.clearHoveredTrajectory.inputSchema,
  host.clearHoveredTrajectory.outputSchema,
  host.clearHoveredTrajectory.requiresEdit,
);
export const trajectory_selectTrajectory = defineRequest(
  "trajectory.selectTrajectory@1",
  host.selectTrajectory.inputSchema,
  host.selectTrajectory.outputSchema,
  host.selectTrajectory.requiresEdit,
);
export const trajectory_closeTrajectory = defineRequest(
  "trajectory.closeTrajectory@1",
  host.closeTrajectory.inputSchema,
  host.closeTrajectory.outputSchema,
  host.closeTrajectory.requiresEdit,
);
export const scene_models_projectCloudAction = defineRequest(
  "scene-models.projectCloudAction@1",
  host.projectCloudAction.inputSchema,
  host.projectCloudAction.outputSchema,
  host.projectCloudAction.requiresEdit,
);
export const scene_models_startCloudPlacement = defineRequest(
  "scene-models.startCloudPlacement@1",
  host.startCloudPlacement.inputSchema,
  host.startCloudPlacement.outputSchema,
  host.startCloudPlacement.requiresEdit,
);
export const scene_models_setActiveTool = defineRequest(
  "scene-models.setActiveTool@1",
  host.setActiveTool.inputSchema,
  host.setActiveTool.outputSchema,
  host.setActiveTool.requiresEdit,
);
export const camera_view_setCameraMode = defineRequest(
  "camera-view.setCameraMode@1",
  host.setCameraMode.inputSchema,
  host.setCameraMode.outputSchema,
  host.setCameraMode.requiresEdit,
);
export const appearance_toggleTheme = defineRequest(
  "appearance.toggleTheme@1",
  host.toggleTheme.inputSchema,
  host.toggleTheme.outputSchema,
  host.toggleTheme.requiresEdit,
);
export const projects_createProject = defineRequest(
  "projects.createProject@1",
  host.createProject.inputSchema,
  host.createProject.outputSchema,
  host.createProject.requiresEdit,
);
export const projects_deleteProject = defineRequest(
  "projects.deleteProject@1",
  host.deleteProject.inputSchema,
  host.deleteProject.outputSchema,
  host.deleteProject.requiresEdit,
);
export const projects_navigate = defineRequest(
  "projects.navigate@1",
  host.navigate.inputSchema,
  host.navigate.outputSchema,
  host.navigate.requiresEdit,
);
export const anchors_addAnchor = defineRequest(
  "anchors.addAnchor@1",
  host.addAnchor.inputSchema,
  host.addAnchor.outputSchema,
  host.addAnchor.requiresEdit,
);
export const anchors_updateAnchor = defineRequest(
  "anchors.updateAnchor@1",
  host.updateAnchor.inputSchema,
  host.updateAnchor.outputSchema,
  host.updateAnchor.requiresEdit,
);
export const anchors_deleteAnchor = defineRequest(
  "anchors.deleteAnchor@1",
  host.deleteAnchor.inputSchema,
  host.deleteAnchor.outputSchema,
  host.deleteAnchor.requiresEdit,
);
export const anchors_setActiveTool = defineRequest(
  "anchors.setActiveTool@1",
  host.setActiveTool.inputSchema,
  host.setActiveTool.outputSchema,
  host.setActiveTool.requiresEdit,
);
export const anchors_hoverAnchor = defineRequest(
  "anchors.hoverAnchor@1",
  host.hoverAnchor.inputSchema,
  host.hoverAnchor.outputSchema,
  host.hoverAnchor.requiresEdit,
);
export const anchors_clearHoveredAnchor = defineRequest(
  "anchors.clearHoveredAnchor@1",
  host.clearHoveredAnchor.inputSchema,
  host.clearHoveredAnchor.outputSchema,
  host.clearHoveredAnchor.requiresEdit,
);
export const camera_orientation_addCameraOrientationKeyframe = defineRequest(
  "camera-orientation.addCameraOrientationKeyframe@1",
  host.addCameraOrientationKeyframe.inputSchema,
  host.addCameraOrientationKeyframe.outputSchema,
  host.addCameraOrientationKeyframe.requiresEdit,
);
export const camera_orientation_updateCameraOrientationKeyframe = defineRequest(
  "camera-orientation.updateCameraOrientationKeyframe@1",
  host.updateCameraOrientationKeyframe.inputSchema,
  host.updateCameraOrientationKeyframe.outputSchema,
  host.updateCameraOrientationKeyframe.requiresEdit,
);
export const camera_orientation_updateDefaultCameraOrientation = defineRequest(
  "camera-orientation.updateDefaultCameraOrientation@1",
  host.updateDefaultCameraOrientation.inputSchema,
  host.updateDefaultCameraOrientation.outputSchema,
  host.updateDefaultCameraOrientation.requiresEdit,
);
export const camera_orientation_deleteCameraOrientationKeyframe = defineRequest(
  "camera-orientation.deleteCameraOrientationKeyframe@1",
  host.deleteCameraOrientationKeyframe.inputSchema,
  host.deleteCameraOrientationKeyframe.outputSchema,
  host.deleteCameraOrientationKeyframe.requiresEdit,
);
export const depth_of_field_addDepthOfFieldKeyframe = defineRequest(
  "depth-of-field.addDepthOfFieldKeyframe@1",
  host.addDepthOfFieldKeyframe.inputSchema,
  host.addDepthOfFieldKeyframe.outputSchema,
  host.addDepthOfFieldKeyframe.requiresEdit,
);
export const depth_of_field_deleteDepthOfFieldKeyframe = defineRequest(
  "depth-of-field.deleteDepthOfFieldKeyframe@1",
  host.deleteDepthOfFieldKeyframe.inputSchema,
  host.deleteDepthOfFieldKeyframe.outputSchema,
  host.deleteDepthOfFieldKeyframe.requiresEdit,
);
export const identity_login = defineRequest(
  "identity.login@1",
  host.login.inputSchema,
  host.login.outputSchema,
  host.login.requiresEdit,
);
export const identity_verify = defineRequest(
  "identity.verify@1",
  host.verify.inputSchema,
  host.verify.outputSchema,
  host.verify.requiresEdit,
);
export const identity_resend = defineRequest(
  "identity.resend@1",
  host.resend.inputSchema,
  host.resend.outputSchema,
  host.resend.requiresEdit,
);
export const identity_cancelLogin = defineRequest(
  "identity.cancelLogin@1",
  host.cancelLogin.inputSchema,
  host.cancelLogin.outputSchema,
  host.cancelLogin.requiresEdit,
);
export const identity_logout = defineRequest(
  "identity.logout@1",
  host.logout.inputSchema,
  host.logout.outputSchema,
  host.logout.requiresEdit,
);
export const playback_setPlaybackFrame = defineRequest(
  "playback.setPlaybackFrame@1",
  host.setPlaybackFrame.inputSchema,
  host.setPlaybackFrame.outputSchema,
  host.setPlaybackFrame.requiresEdit,
);
export const playback_resetPlayback = defineRequest(
  "playback.resetPlayback@1",
  host.resetPlayback.inputSchema,
  host.resetPlayback.outputSchema,
  host.resetPlayback.requiresEdit,
);
export const playback_setPlaying = defineRequest(
  "playback.setPlaying@1",
  host.setPlaying.inputSchema,
  host.setPlaying.outputSchema,
  host.setPlaying.requiresEdit,
);
export const scene_grid_savePreferences = defineRequest(
  "scene-grid.savePreferences@1",
  host.savePreferences.inputSchema,
  host.savePreferences.outputSchema,
  host.savePreferences.requiresEdit,
);
