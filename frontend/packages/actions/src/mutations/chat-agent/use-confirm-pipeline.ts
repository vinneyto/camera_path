"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmProjectPipeline,
  getListProjectPipelinesQueryKey,
} from "@camera-path/api/client/generated/client";

export function useConfirmPipeline() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pipelineId: string) =>
      confirmProjectPipeline(projectId, pipelineId),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: getListProjectPipelinesQueryKey(projectId),
      }),
  });
}
