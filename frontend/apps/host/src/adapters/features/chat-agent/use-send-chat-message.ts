"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@host/adapters/project";
import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

interface SendChatMessageVariables {
  id: string;
  message: string;
  onAccepted: () => void;
}

export function useSendChatMessage(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      message,
      onAccepted,
    }: SendChatMessageVariables) => {
      await projectApi.saveUserMessage(projectId, id, message);
      onAccepted();
      await invalidateProjectResource(queryClient, projectId, "chat");
      return projectApi.chat(projectId, id, message);
    },
    onError: () => invalidateProjectResource(queryClient, projectId, "all"),
    onSuccess: () => invalidateProjectResource(queryClient, projectId, "all"),
  });
}
