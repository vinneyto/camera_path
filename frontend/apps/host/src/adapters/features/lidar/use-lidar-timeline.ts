"use client";
import type { LidarSettings } from "@camera-path/contracts/api";
import {
  deleteLidarTimeline,
  setLidarTimeline,
} from "@host/adapters/api/generated/client";
import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useLidarTimeline(projectId: string) {
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
