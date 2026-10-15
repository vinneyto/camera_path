import { ProjectProviders } from "@host/providers/project-providers";
import { ProjectWorkspace } from "@host/ui/project-workspace";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ProjectProviders key={projectId} projectId={projectId}>
      <ProjectWorkspace projectId={projectId} />
    </ProjectProviders>
  );
}
