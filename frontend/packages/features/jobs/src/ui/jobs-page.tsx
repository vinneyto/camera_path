"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useJobsCatalog } from "@camera-path/api/resources";
import { Badge, Button, Card } from "@camera-path/ui-kit";
import { CreateJobButton } from "./create-job-button";

export function JobsPage() {
  const jobs = useJobsCatalog();
  const entries = jobs.data?.data ?? [];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a job and follow its results.
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
                  <Link
                    href={`/jobs/${job.id}`}
                    className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50">
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-mono text-xs">{job.id}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {job.asset_count}{" "}
                          {job.asset_count === 1 ? "asset" : "assets"}
                        </p>
                      </div>
                      <Badge>
                        {job.completed_at ? "Completed" : "Pending"}
                      </Badge>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
