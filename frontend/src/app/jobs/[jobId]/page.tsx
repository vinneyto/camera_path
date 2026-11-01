import { JobDetailsPage } from "@host/ui/job-details-page";

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobDetailsPage jobId={jobId} />;
}
