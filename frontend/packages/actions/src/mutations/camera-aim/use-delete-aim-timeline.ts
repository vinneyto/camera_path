"use client";
import { deleteAimTimeline } from "@camera-path/api/client/generated/client";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteAimTimeline(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await deleteAimTimeline(projectId);
      if (response.status !== 204)
        throw new Error("Could not delete aim timeline");
    },
    onSettled: () => invalidateProjectResource(queryClient, projectId, "aim"),
  });
}
