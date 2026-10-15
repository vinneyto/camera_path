"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeCreate,
} from "@camera-path/api/project";

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useAddCameraOrientationKeyframe(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyframe: CameraOrientationKeyframeCreate) =>
      projectApi.addCameraOrientationKeyframe(projectId, keyframe),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}
