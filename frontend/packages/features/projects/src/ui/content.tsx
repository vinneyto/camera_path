"use client";
import { useDeleteProjectMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useProjectsCatalog } from "@camera-path/api/resources";
import { useRouter } from "next/navigation";

import { useCreateProjectMutation } from "@camera-path/actions";
import { ProjectCreateForm } from "./project-create-form";
import { ProjectList } from "./project-list";
export function ProjectsContent() {
  const query = useProjectsCatalog();
  const canEdit = useAuth().canEdit;
  const create = useCreateProjectMutation();
  const deletion = useDeleteProjectMutation();
  const go = useRouter().push;
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
