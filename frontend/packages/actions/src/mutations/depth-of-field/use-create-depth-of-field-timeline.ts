"use client";
import { createDepthOfFieldTimeline } from "@camera-path/api/client/generated/client";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateDepthOfFieldTimeline(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await createDepthOfFieldTimeline(projectId);
      if (response.status !== 200)
        throw new Error("Could not create depth-of-field timeline");
    },
    onSettled: () =>
      invalidateProjectResource(queryClient, projectId, "depthOfField"),
  });
}
