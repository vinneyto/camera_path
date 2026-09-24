"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createProjectCloud,
  deleteProjectCloud,
  getGetProjectQueryKey,
  getListProjectCloudsQueryKey,
  updateProjectCloud,
} from "@/shared/api/generated/client";
import type { ProjectCloudUpdate } from "@/shared/api/generated/model";

type Action =
  | { type: "add"; assetId: string }
  | { type: "remove"; cloudId: string }
  | { type: "update"; cloudId: string; changes: ProjectCloudUpdate };

export function useProjectCloudActions(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action) => {
      if (action.type === "add")
        return createProjectCloud(projectId, {
          library_asset_id: action.assetId,
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
