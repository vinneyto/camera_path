"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createProjectCloud,
  deleteProjectCloud,
  getGetProjectQueryKey,
  getListProjectCloudsQueryKey,
  updateProjectCloud,
} from "@camera-path/api/client/generated/client";
import type { ProjectCloudUpdate } from "@camera-path/types/api";

type Action =
  | { type: "add"; assetId: string; translation?: [number, number, number] }
  | { type: "remove"; cloudId: string }
  | { type: "update"; cloudId: string; changes: ProjectCloudUpdate };

export function useProjectCloudActions(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action) => {
      if (action.type === "add")
        return createProjectCloud(projectId, {
          library_asset_id: action.assetId,
          translation: action.translation ?? [0, 0, 0],
        });
      if (action.type === "remove")
        return deleteProjectCloud(projectId, action.cloudId);
      return updateProjectCloud(projectId, action.cloudId, action.changes);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListProjectCloudsQueryKey(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetProjectQueryKey(projectId),
        }),
      ]);
    },
  });
}
