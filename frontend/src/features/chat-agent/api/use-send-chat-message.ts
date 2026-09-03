"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys, type Project } from "@/entities/project";

export function useSendChatMessage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => projectApi.chat(projectId, message),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(projectId) });
      const previousProject = queryClient.getQueryData<Project>(projectKeys.detail(projectId));
      if (previousProject) {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), {
          ...previousProject,
          chat_history: [...previousProject.chat_history, { role: "user", content: message }],
        });
      }
      return { previousProject };
    },
    onError: (_error, _message, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(projectId), context.previousProject);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(projectKeys.detail(projectId), result.project);
      queryClient.setQueryData(projectKeys.trajectory(projectId), result.compiled);
    },
  });
}
