"use client";

import { useJobsCatalog } from "@camera-path/api/resources";
import { Button } from "@camera-path/ui-kit";
import { CreateJobButton } from "./create-job-button";
import { JobListItem } from "./job-list-item";

export function JobsPage() {
  const jobs = useJobsCatalog();
  const entries = jobs.data?.data ?? [];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow the status and results of your jobs.
          </p>
        </div>
        <CreateJobButton />
      </header>
      {jobs.isPending ? (
        <p className="text-xs text-muted-foreground" role="status">
          Loading jobs…
        </p>
      ) : jobs.isError && !jobs.data ? (
        <div className="space-y-3">
          <p className="text-xs text-destructive" role="alert">
            Could not load jobs.
          </p>
          <Button variant="outline" onClick={() => void jobs.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {jobs.isError && (
            <p className="text-xs text-destructive" role="alert">
              Could not refresh jobs. Showing saved results.
            </p>
          )}
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-xs text-muted-foreground">
              No jobs yet.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Jobs">
              {entries.map((job) => (
                <li key={job.id}>
                  <JobListItem job={job} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
