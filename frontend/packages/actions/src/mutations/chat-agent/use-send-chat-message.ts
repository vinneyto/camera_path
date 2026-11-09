"use client";
import { useRef } from "react";
import { useProjectId } from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorActions } from "../../actions-provider";

import { uploadChatImage } from "@camera-path/api/upload-chat-image";
import {
  getListSceneObjectsQueryKey,
  getListLibraryAssetsQueryKey,
  getListJobsQueryKey,
} from "@camera-path/api/client/generated/client";
import { projectApi } from "@camera-path/api/project";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

interface SendChatMessageVariables {
  id: string;
  message: string;
  onAccepted: () => void;
  files?: File[];
  selectedObjectId?: string | null;
}

export function useSendChatMessage(explicitProjectId?: string) {
  const uploads = useRef(
    new WeakMap<
      File,
      { projectId: string; promise: ReturnType<typeof uploadChatImage> }
    >(),
  );
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  const actions = useEditorActions();
  return useMutation({
    mutationFn: async ({
      id,
      message,
      onAccepted,
      files = [],
      selectedObjectId = null,
    }: SendChatMessageVariables) => {
      const attachments = [];
      for (const file of files) {
        let entry = uploads.current.get(file);
        if (!entry || entry.projectId !== projectId) {
          entry = {
            projectId,
            promise: uploadChatImage(projectId, file).catch((error) => {
              uploads.current.delete(file);
              throw error;
            }),
          };
          uploads.current.set(file, entry);
        }
        attachments.push(await entry.promise);
      }
      const context = {
        selected_object_id: selectedObjectId,
        attachment_ids: attachments.map((a) => a.id),
      };
      await projectApi.saveUserMessage(projectId, id, message, context);
      onAccepted();
      await invalidateProjectResource(queryClient, projectId, "chat");
      return {
        response: await projectApi.chat(projectId, id, message, context),
        selectedObjectId,
      };
    },
    onSuccess: ({ response, selectedObjectId }) => {
      if (!selectedObjectId && response.compiled.position_segments.length)
        actions.selectObject({ id: trajectoryObjectId });
    },
    onSettled: () =>
      Promise.all([
        invalidateProjectResource(queryClient, projectId, "all"),
        ...[
          getListSceneObjectsQueryKey(projectId),
          getListLibraryAssetsQueryKey(),
          getListJobsQueryKey(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]),
  });
}
