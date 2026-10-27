"use client";
import { useProjectId } from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorActions } from "../../actions-provider";

import { projectApi } from "@camera-path/api/project";

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useClearTrajectory(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  const actions = useEditorActions();

  return useMutation({
    mutationFn: () => projectApi.clearTrajectory(projectId),
    onSuccess: () => {
      actions.selectObject({ id: null, ifCurrentId: trajectoryObjectId });
      actions.hoverObject({ id: null, ifCurrentId: trajectoryObjectId });
      actions.resetPlayback();
      actions.setCameraMode("orbit");
      return invalidateProjectResource(queryClient, projectId, "trajectory");
    },
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "trajectory"),
  });
}
