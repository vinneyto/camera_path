"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  setLidarTimeline,
  deleteLidarTimeline,
} from "@/shared/api/generated/client";
import type { LidarSettings } from "@/shared/api/generated/model";
import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

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
