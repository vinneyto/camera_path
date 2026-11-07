"use client";

import Link from "next/link";
import { ArrowRight, Box } from "lucide-react";
import type { JobSummary } from "@camera-path/types/api";
import { Badge, Card } from "@camera-path/ui-kit";

export function JobListItem({ job }: { job: JobSummary }) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/jobs/${job.id}`}
          className="group min-w-0 flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">
              {job.type ?? "Type not specified"}
            </span>
            <ArrowRight className="size-3.5" aria-hidden />
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium group-hover:text-primary">
            {job.name ?? "Untitled job"}
          </p>
          <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
            {job.id}
          </p>
        </Link>
        <Badge
          className={`shrink-0 capitalize ${
            job.status === "failed"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : job.status === "succeeded"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : ""
          }`}
        >
          {job.status}
        </Badge>
      </div>
      {job.error && (
        <p className="whitespace-pre-wrap break-words text-xs text-destructive">
          {job.error.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>
          {job.asset_count} {job.asset_count === 1 ? "asset" : "assets"}
        </span>
        {job.created_at && (
          <time dateTime={job.created_at}>
            {new Date(job.created_at).toLocaleString()}
          </time>
        )}
      </div>
      {job.assets.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Results">
          {job.assets.map((asset) => (
            <li key={asset.id}>
              <Link
                href={`/library/${asset.id}`}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Box
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {asset.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
