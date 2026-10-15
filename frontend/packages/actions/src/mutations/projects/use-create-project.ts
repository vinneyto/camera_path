"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys } from "@camera-path/api/project";

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}
