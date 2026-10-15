"use client";
import { useProjectId } from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorActions } from "../../actions-provider";

import { projectApi } from "@camera-path/api/project";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

interface SendChatMessageVariables {
  id: string;
  message: string;
  onAccepted: () => void;
}

export function useSendChatMessage(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  const actions = useEditorActions();
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
    onSuccess: (response) => {
      if (response.compiled.position_segments.length)
        actions.selectObject({ id: trajectoryObjectId });
      return invalidateProjectResource(queryClient, projectId, "all");
    },
  });
}
