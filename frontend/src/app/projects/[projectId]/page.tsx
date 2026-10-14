import { EditorStoreProvider } from "@host/editor";
import { ProjectHostProvider } from "@host/runtime/project-host-provider";
import { ProjectWorkspace } from "@host/ui/project-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return (
    <EditorStoreProvider key={projectId}>
      <ProjectHostProvider projectId={projectId}>
        <ProjectWorkspace projectId={projectId} />
      </ProjectHostProvider>
    </EditorStoreProvider>
  );
}
