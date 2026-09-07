import { EditorStoreProvider } from "@/features/project-editor";
import { ProjectWorkspace } from "@/widgets/project-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ renderer?: string | string[] }>;
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { projectId } = await params;
  const { renderer } = await searchParams;
  return (
    <EditorStoreProvider key={projectId}>
      <ProjectWorkspace
        projectId={projectId}
        rendererBackend={renderer === "webgl" ? "webgl" : "webgpu"}
      />
    </EditorStoreProvider>
  );
}
