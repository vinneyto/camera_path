"use client";

import { Plus } from "lucide-react";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { Button } from "@camera-path/ui-kit";

export function CreateJobButton() {
  const { canEdit } = useAuth();
  if (!canEdit) return null;

  return (
    <Button disabled title="Job creation is not available yet.">
      <Plus className="size-3.5" aria-hidden />
      Create job
    </Button>
  );
}
