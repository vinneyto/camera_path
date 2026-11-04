"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCreateJobMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { Button } from "@camera-path/ui-kit";

export function CreateJobButton() {
  const { canEdit } = useAuth();
  const creation = useCreateJobMutation();
  const router = useRouter();
  if (!canEdit) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        disabled={creation.isPending}
        onClick={() =>
          creation.mutate(undefined, {
            onSuccess: (job) => router.push(`/jobs/${job.id}`),
          })
        }
      >
        <Plus className="size-3.5" aria-hidden />
        {creation.isPending ? "Creating…" : "Create job"}
      </Button>
      {creation.isError && (
        <p className="max-w-56 text-xs text-destructive" role="alert">
          Could not create a job. Please try again.
        </p>
      )}
    </div>
  );
}
