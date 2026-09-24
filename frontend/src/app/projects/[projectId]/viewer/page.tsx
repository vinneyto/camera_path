import { EditorStoreProvider } from "@/features/project-editor";
import { ProjectWorkspace } from "@/widgets/project-workspace";

interface ViewerPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ renderer?: string | string[] }>;
}

export default async function ViewerPage({
  params,
  searchParams,
}: ViewerPageProps) {
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
