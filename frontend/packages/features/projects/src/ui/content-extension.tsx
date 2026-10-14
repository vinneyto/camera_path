"use client";
import {
  projectsCatalog,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { deleteProject, navigate } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
  useRequestAction,
} from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { useCreateProject } from "../api/use-create-project";
import { ProjectCreateForm } from "./project-create-form";
import { ProjectList } from "./project-list";
export function ContentExtension() {
  const query = useDataQuery(manifest, projectsCatalog);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const create = useCreateProject();
  const deletion = useRequestMutation(manifest, deleteProject);
  const go = useRequestAction(manifest, navigate);
  const error = query.error ?? create.error ?? deletion.error;
  return (
    <>
      {canEdit && (
        <div className="mb-4">
          <ProjectCreateForm
            disabled={create.isPending}
            onCreate={async (name) => {
              try {
                const project = await create.mutateAsync(name);
                await go(`/projects/${project.id}`);
                return true;
              } catch {
                return false;
              }
            }}
          />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
        >
          {error.message}
        </p>
      )}
      <ProjectList
        loading={query.isPending}
        projects={query.data?.data ?? []}
        deletingProjectId={deletion.isPending ? deletion.variables : undefined}
        onDelete={(project) => {
          if (
            canEdit &&
            window.confirm(
              `Delete “${project.name}”? This action cannot be undone.`,
            )
          )
            deletion.mutate(project.id);
        }}
      />
    </>
  );
}
