import { EditorStoreProvider } from "@/features/project-editor";
import { ProjectWorkspace } from "@/widgets/project-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return (
    <EditorStoreProvider key={projectId}>
      <ProjectWorkspace projectId={projectId} />
    </EditorStoreProvider>
  );
}
