"use client";
import { useProjectCloudActionMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useSceneModels } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";
import { useProjectId } from "@camera-path/store";
import type { ProjectCloud } from "@camera-path/types/api";

export function RemoveCloudCommand() {
  const canEdit = useAuth().canEdit;
  const projectId = useProjectId();
  const projectClouds = useSceneModels(projectId);
  const actions = useProjectCloudActionMutation(projectId);
  const clouds = (projectClouds.data?.data ?? []) as ProjectCloud[];
  if (!canEdit) return null;
  return (
    <Command
      id="scene-models.remove-cloud"
      label="Cloud: Remove"
      items={clouds.map((cloud, index) => ({
        id: cloud.id,
        label: `${cloud.name} · ${index + 1} · ${cloud.id.slice(0, 8)}`,
        searchText: cloud.id,
      }))}
      onSelectItem={(cloudId) => actions.mutate({ type: "remove", cloudId })}
      loading={projectClouds.isPending}
      error={projectClouds.error ? "Could not load project clouds." : undefined}
      emptyMessage="This project has no clouds yet."
      disabled={actions.isPending}
      actionError={actions.error?.message}
    />
  );
}
