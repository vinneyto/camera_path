"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  projectKeys,
  type DepthOfFieldKeyframeCreate,
} from "@/entities/project";

export function useAddDepthOfFieldKeyframe(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyframe: DepthOfFieldKeyframeCreate) =>
      projectApi.addDepthOfFieldKeyframe(projectId, keyframe),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.trajectory(projectId),
      });
    },
  });
}
