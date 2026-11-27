"use client";
import { useEffect } from "react";
import { useProjectId } from "@camera-path/store";
import { useQueryClient } from "@tanstack/react-query";
import type { Pipeline } from "@camera-path/types/api";
import { subscribePipelines } from "@camera-path/api/subscribe-pipelines";
import {
  getListProjectPipelinesQueryKey,
  getListSceneObjectsQueryKey,
  getListLibraryAssetsQueryKey,
  getListJobsQueryKey,
  getListProjectGenerationJobsQueryKey,
} from "@camera-path/api/client/generated/client";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function usePipelineEvents() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  useEffect(() => {
    const queryKey = getListProjectPipelinesQueryKey(projectId);
    const refresh = () => {
      void Promise.all([
        invalidateProjectResource(queryClient, projectId, "all"),
        ...[
          getListSceneObjectsQueryKey(projectId),
          getListLibraryAssetsQueryKey(),
          getListJobsQueryKey(),
          getListProjectGenerationJobsQueryKey(projectId),
        ].map((key) => queryClient.invalidateQueries({ queryKey: key })),
      ]);
    };
    const merge = (incoming: Pipeline[]) => {
      queryClient.setQueryData<{
        data: Pipeline[];
        status: number;
        headers: Headers;
      }>(queryKey, (previous) => {
        const items = new Map((previous?.data ?? []).map((p) => [p.id, p]));
        for (const pipeline of incoming) {
          if ((items.get(pipeline.id)?.version ?? 0) <= pipeline.version)
            items.set(pipeline.id, pipeline);
        }
        return {
          data: [...items.values()],
          status: 200,
          headers: new Headers(),
        };
      });
    };
    return subscribePipelines(
      projectId,
      (pipelines) => {
        merge(pipelines);
        refresh();
      },
      (pipeline, stepId) => {
        merge([pipeline]);
        const step = pipeline.steps.find((s) => s.id === stepId);
        if (step?.status === "succeeded" || step?.status === "failed")
          refresh();
      },
    );
  }, [projectId, queryClient]);
}
