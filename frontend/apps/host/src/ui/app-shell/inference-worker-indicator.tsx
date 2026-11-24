"use client";

import { useInferenceStatus } from "@camera-path/api/inference/use-inference-status";
import { Tooltip } from "@camera-path/ui-kit";

export function InferenceWorkerIndicator() {
  const { canEdit, status } = useInferenceStatus();
  if (!canEdit) return null;

  const capabilities = [
    status?.capabilities.includes("generate_image") && "2D",
    status?.capabilities.includes("generate_model") && "3D",
  ].filter(Boolean);
  const label = status?.connected
    ? `Inference worker connected${capabilities.length ? `: ${capabilities.join(" and ")}` : ""}`
    : status
      ? "Inference worker offline"
      : "Inference worker status unavailable";

  return (
    <Tooltip label={label}>
      <span
        role="status"
        tabIndex={0}
        title={label}
        aria-label={label}
        className="inline-flex items-center gap-1 rounded px-1 py-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={`size-2 rounded-full ${status?.connected ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
        />
        {status?.connected && capabilities.length > 0 && (
          <span aria-hidden className="md:hidden">
            {capabilities.join(" + ")}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
