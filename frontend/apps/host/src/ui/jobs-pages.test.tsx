// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SlotProvider } from "@camera-path/slots";
import type { Job, JobSummary, LibraryAsset } from "@camera-path/types/api";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { featureSlots } from "@host/composition/feature-slots";
import { JobsPage } from "./jobs-page";
import { JobDetailsPage } from "./job-details-page";

const identity = vi.hoisted(() => ({ canEdit: true, push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: identity.push }),
}));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => identity,
}));

const id = "443f452a-cb09-4eb5-9087-9643d99c649a";
const pending: Job = { id, completed_at: null, assets: [] };
const asset: LibraryAsset = {
  id: "cloud-1",
  job_id: id,
  name: "Generated cloud",
  format: "ply",
  status: "ready",
  size_bytes: 1024,
  created_at: "2026-11-01T12:00:00Z",
  tags: [],
  default_rotation_deg: [0, 0, 0],
  default_scale: 1,
  default_offset: [0, 0, 0],
  primary_file_id: "full",
  files: [
    { id: "full", format: "ply", size_bytes: 1024, download_url: "/full.ply" },
    {
      id: "preview",
      format: "ply",
      size_bytes: 128,
      download_url: "/preview.ply",
    },
  ],
};
const completed: Job = {
  ...pending,
  completed_at: "2026-11-01T12:00:00Z",
  assets: [asset],
};
let jobs: JobSummary[];
let job: Job;
let listError: boolean;
let createError: boolean;
let detailStatus: number;
let releaseCreate: (() => void) | undefined;
let holdCreate: boolean;
const requests: { url: string; method: string; body: unknown }[] = [];
const clients: QueryClient[] = [];

function mount(detailId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const page = (detailId?: string) => (
    <QueryClientProvider client={client}>
      <SlotProvider features={featureSlots}>
        {detailId ? <JobDetailsPage jobId={detailId} /> : <JobsPage />}
      </SlotProvider>
    </QueryClientProvider>
  );
  const result = render(page(detailId));
  return { client, changeJob: (next: string) => result.rerender(page(next)) };
}

beforeEach(() => {
  identity.canEdit = true;
  identity.push.mockReset();
  job = structuredClone(pending);
  jobs = [];
  listError = createError = holdCreate = false;
  detailStatus = 200;
  releaseCreate = undefined;
  requests.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      requests.push({
        url,
        method: options.method ?? "GET",
        body: options.body,
      });
      if (url === "/api/v1/jobs") {
        if (options.method === "POST") {
          if (holdCreate)
            await new Promise<void>((resolve) => {
              releaseCreate = resolve;
            });
          if (createError)
            return Response.json({ detail: "Unavailable" }, { status: 503 });
          jobs = [{ id, completed_at: null, asset_count: 0 }];
          return Response.json(pending, { status: 201 });
        }
        return listError
          ? Response.json({ detail: "Unavailable" }, { status: 503 })
          : Response.json(jobs);
      }
      return detailStatus === 200
        ? Response.json(job)
        : Response.json({ detail: "Missing job" }, { status: detailStatus });
    }),
  );
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

it("shows an empty public list without creation controls for guests", async () => {
  identity.canEdit = false;
  mount();
  await screen.findByText("No jobs yet.");
  expect(screen.queryByRole("button", { name: "Create job" })).toBeNull();
  expect(requests.every((request) => request.method === "GET")).toBe(true);
});

it("creates a job without a body, blocks duplicate submits, refreshes the list and opens details", async () => {
  holdCreate = true;
  mount();
  await screen.findByText("No jobs yet.");
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
  const button = await screen.findByRole("button", { name: "Creating…" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  await waitFor(() => expect(releaseCreate).toBeDefined());
  expect(requests.filter((request) => request.method === "POST")).toEqual([
    { url: "/api/v1/jobs", method: "POST", body: undefined },
  ]);
  await act(async () => releaseCreate!());
  await waitFor(() =>
    expect(identity.push).toHaveBeenCalledWith(`/jobs/${id}`),
  );
  const link = await screen.findByRole("link", { name: new RegExp(id) });
  expect(link.getAttribute("href")).toBe(`/jobs/${id}`);
  expect(link.textContent).toContain("Pending");
  expect(link.textContent).toContain("0 assets");
});

it("keeps creation errors visible and allows an explicit retry", async () => {
  createError = true;
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not create",
  );
  expect(identity.push).not.toHaveBeenCalled();
  createError = false;
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
  await waitFor(() =>
    expect(identity.push).toHaveBeenCalledWith(`/jobs/${id}`),
  );
});

it("retries a failed catalogue read and shows completed result counts", async () => {
  listError = true;
  jobs = [{ id, completed_at: completed.completed_at, asset_count: 1 }];
  mount();
  await screen.findByRole("alert");
  listError = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  const link = await screen.findByRole("link", { name: new RegExp(id) });
  expect(link.textContent).toContain("Completed");
  expect(link.textContent).toContain("1 asset");
});

it("refreshes pending job results automatically and links each result to the library", async () => {
  mount(id);
  await screen.findByText("Waiting for results.");
  expect(screen.getByText(id)).toBeTruthy();
  job = structuredClone(completed);
  await screen.findByText("Completed", {}, { timeout: 4000 });
  const link = screen.getByRole("link", { name: /Generated cloud/ });
  expect(link.getAttribute("href")).toBe("/library/cloud-1");
  expect(link.textContent).toContain("2 files");
  expect(screen.queryByText("Waiting for results.")).toBeNull();
});

it("shows every result and keeps completed jobs completed after result removal", async () => {
  job = {
    ...completed,
    assets: [asset, { ...asset, id: "cloud-2", name: "Second result" }],
  };
  mount(id);
  await screen.findByRole("link", { name: /Generated cloud/ });
  expect(
    screen.getByRole("link", { name: /Second result/ }).getAttribute("href"),
  ).toBe("/library/cloud-2");
  job = { ...completed, assets: [] };
  fireEvent.click(screen.getByRole("button", { name: "Refresh job" }));
  await screen.findByText("No assets remain for this job.");
  expect(screen.getByText("Completed")).toBeTruthy();
});

it("clears the previous job when navigating to a missing job", async () => {
  job = structuredClone(completed);
  const view = mount(id);
  await screen.findByRole("link", { name: /Generated cloud/ });
  detailStatus = 404;
  view.changeJob("unknown");
  await screen.findByRole("heading", { name: "Job not found" });
  expect(screen.queryByRole("link", { name: /Generated cloud/ })).toBeNull();
  expect(
    screen.getByRole("link", { name: "← Jobs" }).getAttribute("href"),
  ).toBe("/jobs");
});
