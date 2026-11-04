import { Slot } from "@camera-path/slots";
import { ResourceScopeProvider } from "@camera-path/store";

export function JobDetailsPage({ jobId }: { jobId: string }) {
  return (
    <ResourceScopeProvider key={jobId} jobId={jobId}>
      <Slot name="jobs.details" />
    </ResourceScopeProvider>
  );
}
