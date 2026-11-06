"use client";

import Link from "next/link";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { JobCreateForm } from "./job-create-form";

export function JobCreatePage() {
  const { canEdit, loading } = useAuth();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <Link
        className="w-fit text-xs text-muted-foreground hover:underline"
        href="/jobs"
      >
        ← Jobs
      </Link>
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Create generation job
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Set the parameters and queue a new generation job.
        </p>
      </header>
      {loading ? (
        <p className="text-xs text-muted-foreground" role="status">
          Checking editor access…
        </p>
      ) : canEdit ? (
        <JobCreateForm />
      ) : (
        <p className="text-xs text-muted-foreground">
          Sign in as an editor to create a job.
        </p>
      )}
    </main>
  );
}
