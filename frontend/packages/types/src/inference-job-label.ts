import type { JobStatus } from "./api";
import type { InferenceCommand, InferenceStatus } from "./inference";

export function inferenceJobLabel(
  job: { status: JobStatus; inference_command?: InferenceCommand | null },
  worker: InferenceStatus | undefined,
): string {
  return job.status === "queued" &&
    job.inference_command &&
    worker &&
    !worker.capabilities.includes(job.inference_command)
    ? "Waiting for worker"
    : job.status;
}
