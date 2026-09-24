import { redirect } from "next/navigation";

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
  const query = renderer === "webgl" ? "?renderer=webgl" : "";
  redirect(`/projects/${encodeURIComponent(projectId)}${query}`);
}
