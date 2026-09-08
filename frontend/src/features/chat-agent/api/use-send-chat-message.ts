"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, projectKeys, type Project } from "@/entities/project";

interface SendChatMessageVariables {
  id: string;
  message: string;
  onAccepted: () => void;
}

export function useSendChatMessage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, message, onAccepted }: SendChatMessageVariables) => {
      const project = await projectApi.saveUserMessage(projectId, id, message);
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      onAccepted();
      return projectApi.chat(projectId, id, message);
    },
    onMutate: async ({ id, message }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(projectId) });
      const previousProject = queryClient.getQueryData<Project>(projectKeys.detail(projectId));
      if (previousProject) {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), {
          ...previousProject,
          chat_history: previousProject.chat_history.some((item) => item.id === id)
            ? previousProject.chat_history
            : [...previousProject.chat_history, { id, role: "user", content: message }],
        });
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(projectKeys.detail(projectId), result.project);
      queryClient.setQueryData(projectKeys.trajectory(projectId), result.compiled);
    },
  });
}
