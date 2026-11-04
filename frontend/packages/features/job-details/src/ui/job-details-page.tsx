"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useJobResource } from "@camera-path/api/resources";
import { Badge, Button } from "@camera-path/ui-kit";
import { JobResultCard } from "./job-result-card";

export function JobDetailsPage() {
  const resource = useJobResource();
  const job = resource.data?.status === 200 ? resource.data.data : undefined;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <Link
        className="w-fit text-xs text-muted-foreground hover:underline"
        href="/jobs"
      >
        ← Jobs
      </Link>
      {resource.isPending ? (
        <p className="text-xs text-muted-foreground" role="status">
          Loading job…
        </p>
      ) : !job ? (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">
            {resource.notFound ? "Job not found" : "Could not load this job"}
          </h1>
          {!resource.notFound && (
            <Button variant="outline" onClick={() => void resource.refetch()}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        <>
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                Job details
              </h1>
              <p className="mt-2 select-all break-all font-mono text-xs text-muted-foreground">
                {job.id}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh job"
              disabled={resource.isFetching}
              onClick={() => void resource.refetch()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
            </Button>
          </header>
          <div
            className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <Badge>{job.completed_at ? "Completed" : "Pending"}</Badge>
            {job.completed_at ? (
              <time dateTime={job.completed_at}>
                {new Date(job.completed_at).toLocaleString()}
              </time>
            ) : (
              <span>Waiting for results.</span>
            )}
          </div>
          {resource.isError && (
            <p className="text-xs text-destructive" role="alert">
              Could not refresh this job. Try again.
            </p>
          )}
          <section className="space-y-3" aria-labelledby="job-assets-heading">
            <h2 id="job-assets-heading" className="text-sm font-medium">
              Assets ({job.assets.length})
            </h2>
            {job.assets.length ? (
              <ul className="space-y-2">
                {job.assets.map((asset) => (
                  <li key={asset.id}>
                    <JobResultCard asset={asset} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                {job.completed_at
                  ? "No assets remain for this job."
                  : "Results will appear here when the job completes."}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
