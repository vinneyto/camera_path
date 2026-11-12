import type { Pipeline } from "@camera-path/types/api";

export function mergePipelineResponse(
  previous: unknown,
  incoming: unknown,
): unknown {
  if (
    !incoming ||
    typeof incoming !== "object" ||
    !("data" in incoming) ||
    !Array.isArray(incoming.data)
  )
    return incoming;
  const old =
    previous &&
    typeof previous === "object" &&
    "data" in previous &&
    Array.isArray(previous.data)
      ? (previous.data as Pipeline[])
      : [];
  const items = new Map(old.map((pipeline) => [pipeline.id, pipeline]));
  for (const pipeline of incoming.data as Pipeline[]) {
    if ((items.get(pipeline.id)?.version ?? 0) <= pipeline.version)
      items.set(pipeline.id, pipeline);
  }
  return { ...incoming, data: [...items.values()] };
}
