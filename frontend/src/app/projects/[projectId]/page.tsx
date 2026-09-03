import { ProjectWorkspace } from "@/widgets/project-workspace/ui/project-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <ProjectWorkspace projectId={projectId} />;
}
