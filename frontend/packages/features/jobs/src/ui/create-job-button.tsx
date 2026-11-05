"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { Button } from "@camera-path/ui-kit";

export function CreateJobButton() {
  const { canEdit } = useAuth();
  const router = useRouter();
  if (!canEdit) return null;

  return (
    <Button type="button" onClick={() => router.push("/jobs/new")}>
      <Plus className="size-3.5" aria-hidden />
      Create job
    </Button>
  );
}
