"use client";
import {
  deleteLidarTimeline,
  setLidarTimeline,
} from "@camera-path/api/client/generated/client";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";
import { useProjectId } from "@camera-path/store";
import type { LidarSettings } from "@camera-path/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useLidarTimeline(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: LidarSettings | null): Promise<void> => {
      const response =
        settings === null
          ? await deleteLidarTimeline(projectId)
          : await setLidarTimeline(projectId, settings);
      if (response.status !== 200 && response.status !== 204)
        throw new Error("Could not save LiDAR timeline");
    },
    onSettled: () => invalidateProjectResource(queryClient, projectId, "lidar"),
  });
}
