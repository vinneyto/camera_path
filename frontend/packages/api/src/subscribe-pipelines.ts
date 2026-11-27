import { API_URL } from "./config";
import type { Pipeline } from "@camera-path/types/api";

export function subscribePipelines(
  projectId: string,
  onSnapshot: (pipelines: Pipeline[]) => void,
  onUpdate: (pipeline: Pipeline, stepId: string | null) => void,
) {
  const source = new EventSource(
    `${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/pipelines/events`,
    { withCredentials: true },
  );
  source.addEventListener("snapshot", (event) => {
    onSnapshot(JSON.parse((event as MessageEvent<string>).data) as Pipeline[]);
  });
  source.addEventListener("pipeline", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as {
      pipeline: Pipeline;
      step_id: string | null;
    };
    onUpdate(payload.pipeline, payload.step_id);
  });
  return () => source.close();
}
