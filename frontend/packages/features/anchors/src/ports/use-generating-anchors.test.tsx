// @vitest-environment happy-dom
import { getListProjectGenerationJobsQueryKey } from "@camera-path/api/client/generated/client";
import { ResourceScopeProvider } from "@camera-path/store";
import type { JobSummary } from "@camera-path/types/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGeneratingAnchors } from "./use-generating-anchors";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const projectId = "anchor-generation-test";
const queuedJob: JobSummary = {
  id: "replacement-job",
  type: "generation",
  name: "chair.png",
  prompt: null,
  status: "queued",
  created_at: null,
  started_at: null,
  completed_at: null,
  error: null,
  asset_count: 0,
  assets: [],
  scene_placement: {
    project_id: projectId,
    status: "pending",
    anchor: {
      id: "anchor-a",
      label: "A",
      surface_position: [0, 0, 0],
      surface_normal: [0, 1, 0],
      lift: 1,
      lift_axis: "world_up",
    },
  },
};

it("shows persisted queued/running replacements and clears all terminal states", async () => {
  const ignoredPlacement = {
    ...queuedJob.scene_placement!,
    anchor: { ...queuedJob.scene_placement!.anchor, id: "ignored-anchor" },
  };
  let jobs: JobSummary[] = [
    queuedJob,
    { ...queuedJob, id: "ordinary-generation", scene_placement: null },
    {
      ...queuedJob,
      id: "another-project",
      scene_placement: {
        ...ignoredPlacement,
        project_id: "other-project",
      },
    },
    {
      ...queuedJob,
      id: "skipped-placement",
      scene_placement: { ...ignoredPlacement, status: "skipped" },
    },
    {
      ...queuedJob,
      id: "different-job-type",
      type: "reconstruction",
      scene_placement: ignoredPlacement,
    },
  ];
  const fetchJobs = vi.fn(async (url: string) => {
    expect(url).toContain(`/projects/${projectId}/generation-jobs`);
    return new Response(JSON.stringify(jobs), {
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchJobs);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result, unmount } = renderHook(() => useGeneratingAnchors(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <ResourceScopeProvider projectId={projectId}>
          {children}
        </ResourceScopeProvider>
      </QueryClientProvider>
    ),
  });
  await waitFor(() => expect(result.current).toEqual(new Set(["anchor-a"])));
  expect(String(fetchJobs.mock.calls[0][0])).toContain(
    `/projects/${projectId}/generation-jobs`,
  );

  // A second active request for the same anchor must keep its indicator visible.
  jobs = [
    { ...queuedJob, status: "succeeded" },
    { ...queuedJob, id: "second-job", status: "running" },
  ];
  await act(() =>
    client.invalidateQueries({
      queryKey: getListProjectGenerationJobsQueryKey(projectId),
    }),
  );
  expect(result.current).toEqual(new Set(["anchor-a"]));

  for (const status of ["failed", "cancelled", "succeeded"] as const) {
    jobs = [{ ...queuedJob, status }];
    await act(() =>
      client.invalidateQueries({
        queryKey: getListProjectGenerationJobsQueryKey(projectId),
      }),
    );
    await waitFor(() => expect(result.current.size).toBe(0));
  }
  unmount();
  client.clear();
});
