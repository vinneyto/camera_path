"use client";
import { useProjectId } from "@camera-path/store";
import { anchorObjectId } from "@camera-path/types/anchor-object-id";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorActions } from "../../actions-provider";

import { projectApi } from "@camera-path/api/project";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useDeleteAnchor(explicitProjectId?: string) {
  const actions = useEditorActions();
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.deleteAnchor(projectId, id),
    onSuccess: (_, anchorId) => {
      const id = anchorObjectId(anchorId);
      actions.hoverObject({ id: null, ifCurrentId: id });
      actions.selectObject({ id: null, ifCurrentId: id });
      return invalidateProjectResource(queryClient, projectId, "anchors");
    },
    onError: () => invalidateProjectResource(queryClient, projectId, "anchors"),
  });
}
