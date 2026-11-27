"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createSceneObject,
  deleteSceneObject,
  getGetProjectQueryKey,
  getListSceneObjectsQueryKey,
  updateSceneObject,
} from "@camera-path/api/client/generated/client";
import type { SceneObjectUpdate } from "@camera-path/types/api";
import { useEditorActions } from "../../actions-provider";

type Action =
  | { type: "add"; assetId: string; position?: [number, number, number] }
  | { type: "remove"; cloudId: string }
  | { type: "update"; cloudId: string; changes: SceneObjectUpdate };

export function useSceneObjectActions(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  const actions = useEditorActions();
  return useMutation({
    mutationFn: async (action: Action) => {
      if (action.type === "add")
        return createSceneObject(projectId, {
          library_asset_id: action.assetId,
          ...(action.position === undefined
            ? {}
            : { position: action.position }),
        });
      if (action.type === "remove")
        return deleteSceneObject(projectId, action.cloudId);
      return updateSceneObject(projectId, action.cloudId, action.changes);
    },
    onSuccess: (_, action) => {
      if (action.type === "remove")
        actions.clearRemovedSceneObjects([action.cloudId]);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListSceneObjectsQueryKey(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetProjectQueryKey(projectId),
        }),
      ]);
    },
  });
}
