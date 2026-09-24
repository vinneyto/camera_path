import { ProjectDetails } from "@/widgets/project-workspace/ui/project-details";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <ProjectDetails projectId={projectId} />;
}
