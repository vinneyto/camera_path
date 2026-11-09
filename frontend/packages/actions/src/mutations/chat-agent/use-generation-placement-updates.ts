"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectId } from "@camera-path/store";

import {
  useListProjectGenerationJobs,
  getListSceneObjectsQueryKey,
  getListLibraryAssetsQueryKey,
} from "@camera-path/api/client/generated/client";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useGenerationPlacementUpdates() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const jobs = useListProjectGenerationJobs(projectId, {
    query: { refetchInterval: 5000 },
  });
  const signature = JSON.stringify(
    jobs.data?.status === 200
      ? jobs.data.data
          .filter(
            (job) =>
              job.scene_placement?.project_id === projectId &&
              job.scene_placement.status !== "pending",
          )
          .map((job) => [job.id, job.scene_placement])
      : [],
  );
  useEffect(() => {
    if (signature === "[]") return;
    void Promise.all([
      invalidateProjectResource(queryClient, projectId, "all"),
      queryClient.invalidateQueries({
        queryKey: getListSceneObjectsQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListLibraryAssetsQueryKey(),
      }),
    ]);
  }, [signature, projectId, queryClient]);
}
