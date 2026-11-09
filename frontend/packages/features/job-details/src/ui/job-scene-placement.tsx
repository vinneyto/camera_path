import Link from "next/link";
import type { Job } from "@camera-path/types/api";

export function JobScenePlacement({ job }: { job: Job }) {
  const placement = job.scene_placement;
  if (!placement) return null;
  const text =
    placement.status === "succeeded"
      ? "The generated model replaced the anchor."
      : placement.status === "skipped"
        ? `The model is in the library. The anchor was kept: ${placement.reason ?? "placement was unavailable"}.`
        : job.status === "failed"
          ? "Generation failed. The anchor was kept."
          : "After generation, the model will replace this anchor and fit its height.";
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">
        Scene placement · {placement.anchor.label}
      </h2>
      <p className="text-xs text-muted-foreground">{text}</p>
      <Link
        className="text-xs underline"
        href={`/projects/${placement.project_id}`}
      >
        Open scene
      </Link>
    </section>
  );
}
