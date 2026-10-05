import { redirect } from "next/navigation";

interface ViewerPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${encodeURIComponent(projectId)}`);
}
