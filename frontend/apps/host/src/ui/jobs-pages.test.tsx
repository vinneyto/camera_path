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
import { JobCreatePage } from "./job-create-page";
import { JobDetailsPage } from "./job-details-page";

const { identity, push } = vi.hoisted(() => ({
  identity: { canEdit: true, loading: false },
  push: vi.fn(),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => identity,
}));

const id = "443f452a-cb09-4eb5-9087-9643d99c649a";
const pending: Job = {
  id,
  name: "A wooden chair",
  type: "generation",
  status: "running",
  input: { prompt: "A wooden chair" },
  created_at: "2026-11-04T12:00:00Z",
  started_at: "2026-11-04T12:00:01Z",
  completed_at: null,
  error: null,
  assets: [],
};
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
  status: "succeeded",
  completed_at: "2026-11-04T12:01:00Z",
  assets: [asset],
};
const completedSummary: JobSummary = {
  id,
  name: "A wooden chair",
  type: "generation",
  status: "succeeded",
  created_at: completed.created_at,
  started_at: completed.started_at,
  completed_at: completed.completed_at,
  error: null,
  prompt: "A wooden chair",
  asset_count: 1,
  assets: [{ id: asset.id, name: asset.name }],
};
let jobs: JobSummary[];
let job: Job;
let listError: boolean;
let createError: boolean;
let detailStatus: number;
const requests: { url: string; method: string; body?: BodyInit | null }[] = [];
const clients: QueryClient[] = [];

function mount(detailId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const page = (detailId?: string) => (
    <QueryClientProvider client={client}>
      <SlotProvider features={featureSlots}>
        {detailId === "new" ? (
          <JobCreatePage />
        ) : detailId ? (
          <JobDetailsPage jobId={detailId} />
        ) : (
          <JobsPage />
        )}
      </SlotProvider>
    </QueryClientProvider>
  );
  const result = render(page(detailId));
  return { client, changeJob: (next: string) => result.rerender(page(next)) };
}

beforeEach(() => {
  identity.canEdit = true;
  job = structuredClone(pending);
  jobs = [];
  listError = false;
  createError = false;
  detailStatus = 200;
  push.mockClear();
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
          return createError
            ? Response.json({ detail: "Unavailable" }, { status: 503 })
            : Response.json({ ...pending, status: "queued" }, { status: 201 });
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

it("opens creation from the list and queues generation", async () => {
  const view = mount();
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
  expect(push).toHaveBeenCalledWith("/jobs/new");
  expect(requests.every((request) => request.method === "GET")).toBe(true);
  view.changeJob("new");
  const submit = screen.getByRole("button", {
    name: "Create and generate",
  }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  const prompt = screen.getByRole("textbox", {
    name: "Prompt",
  }) as HTMLTextAreaElement;
  fireEvent.change(prompt, { target: { value: "A wooden chair" } });
  createError = true;
  fireEvent.click(submit);
  await screen.findByRole("alert");
  expect(prompt.value).toBe("A wooden chair");
  expect(push).not.toHaveBeenCalledWith(`/jobs/${id}`);

  createError = false;
  fireEvent.click(submit);
  await waitFor(() => expect(push).toHaveBeenCalledWith(`/jobs/${id}`));
  const submissions = requests.filter((request) => request.method === "POST");
  expect(
    submissions.map((request) => ({
      url: request.url,
      body: JSON.parse(String(request.body)),
    })),
  ).toEqual([
    {
      url: "/api/v1/jobs",
      body: {
        type: "generation",
        input: { prompt: "A wooden chair" },
        start: true,
      },
    },
    {
      url: "/api/v1/jobs",
      body: {
        type: "generation",
        input: { prompt: "A wooden chair" },
        start: true,
      },
    },
  ]);
});

it("sends an explicit text job name outside the pipeline input", async () => {
  mount("new");
  expect(screen.queryByLabelText("Job name (optional)")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Set name" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Job name (optional)" }),
    { target: { value: " Hero chair " } },
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
    target: { value: "A small wooden chair with curved legs" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create and generate" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(`/jobs/${id}`));
  const sent = requests.find((request) => request.method === "POST");
  expect(JSON.parse(String(sent?.body))).toEqual({
    type: "generation",
    input: { prompt: "A small wooden chair with curved legs" },
    start: true,
    name: "Hero chair",
  });
});

it.each(["", " Hero image "])(
  "keeps the source filename when an image job name is %j",
  async (name) => {
    const imageId = "74eeae84-3235-4825-bd78-c6cdedd3628c";
    const submissions: { url: string; options: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options: RequestInit = {}) => {
        submissions.push({ url, options });
        if (url === "/api/v1/library/uploads")
          return Response.json(
            { id: imageId, upload_url: "/upload-image" },
            { status: 201 },
          );
        if (url === "/upload-image") return new Response(null, { status: 204 });
        if (url.endsWith("/complete"))
          return Response.json({
            id: imageId,
            name: "chair.png",
            format: "png",
          });
        if (url === "/api/v1/jobs")
          return Response.json(
            { ...pending, status: "queued" },
            { status: 201 },
          );
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    mount("new");
    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "image" },
    });
    expect(screen.queryByLabelText("Job name (optional)")).toBeNull();
    expect(
      screen.queryByText(
        /first 5 prompt words|full image filename|joined with underscores/i,
      ),
    ).toBeNull();
    if (name) {
      fireEvent.click(screen.getByRole("button", { name: "Set name" }));
      fireEvent.change(screen.getByLabelText("Job name (optional)"), {
        target: { value: name },
      });
    }
    fireEvent.change(screen.getByLabelText("Source image"), {
      target: {
        files: [
          new File(["image fixture"], "chair.png", { type: "image/png" }),
        ],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create and generate" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/jobs/${id}`));
    const upload = submissions.find(
      (request) => request.url === "/api/v1/library/uploads",
    );
    expect(JSON.parse(String(upload?.options.body))).toMatchObject({
      name: "chair.png",
      format: "png",
    });
    const sent = submissions.find((request) => request.url === "/api/v1/jobs");
    expect(JSON.parse(String(sent?.options.body))).toEqual({
      type: "generation",
      input: { image_asset_id: imageId },
      start: true,
      ...(name.trim() ? { name: name.trim() } : {}),
    });
  },
);

it("asks guests to sign in on the creation route", () => {
  identity.canEdit = false;
  mount("new");
  expect(
    screen.getByText("Sign in as an editor to create a job."),
  ).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Prompt" })).toBeNull();
  expect(requests).toHaveLength(0);
});

it("shows saved name, explicit status, error, unknown type and direct library result links", async () => {
  jobs = [
    completedSummary,
    {
      ...completedSummary,
      id: "failed-job",
      status: "failed",
      name: "A broken chair",
      prompt: "A broken chair",
      asset_count: 0,
      assets: [],
      error: {
        code: "generation_failed",
        message: "Generation failed. Please retry later.",
      },
    },
    {
      ...completedSummary,
      id: "legacy-job",
      status: "draft",
      completed_at: null,
      started_at: null,
      type: null,
      name: null,
      prompt: null,
      created_at: null,
      asset_count: 0,
      assets: [],
    },
  ];
  mount();
  const link = await screen.findByRole("link", { name: /A wooden chair/ });
  expect(link.getAttribute("href")).toBe(`/jobs/${id}`);
  expect(screen.getByText("succeeded")).toBeTruthy();
  expect(screen.getByText("failed")).toBeTruthy();
  expect(
    screen.getByText("Generation failed. Please retry later."),
  ).toBeTruthy();
  expect(screen.getByText("Type not specified")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Generated cloud" }).getAttribute("href"),
  ).toBe("/library/cloud-1");
  expect(requests.every((r) => r.url === "/api/v1/jobs")).toBe(true);
});

it("uses the image job's saved name without fetching the deleted source image", async () => {
  jobs = [
    {
      ...completedSummary,
      name: "My source image.png",
      prompt: null,
      image_asset_id: "deleted-image",
    },
  ];
  mount();
  const link = await screen.findByRole("link", { name: /My source image.png/ });
  expect(link.getAttribute("href")).toBe(`/jobs/${id}`);
  expect(screen.queryByText("Image to 3D")).toBeNull();
  expect(requests.every((request) => request.url === "/api/v1/jobs")).toBe(
    true,
  );
});

it("retries a failed catalogue read", async () => {
  listError = true;
  jobs = [completedSummary];
  mount();
  await screen.findByRole("alert");
  listError = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("link", { name: /A wooden chair/ });
  expect(screen.getByText("1 asset")).toBeTruthy();
});

it("refreshes running jobs on SSE and links the imported asset", async () => {
  const connections: JobEventSource[] = [];
  class JobEventSource extends EventTarget {
    close = vi.fn();

    constructor(readonly url: string) {
      super();
      connections.push(this);
    }
  }
  vi.stubGlobal("EventSource", JobEventSource);
  mount(id);
  await screen.findByText("Waiting for results.");
  expect(screen.getByText(id)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "A wooden chair" })).toBeTruthy();
  const source = connections[0];
  expect(source.url).toBe(`/api/v1/jobs/${id}/events`);
  job = structuredClone(completed);
  source.dispatchEvent(new Event("job-status"));
  await screen.findByText("succeeded");
  const link = screen.getByRole("link", { name: /Generated cloud/ });
  expect(link.getAttribute("href")).toBe("/library/cloud-1");
  expect(link.textContent).toContain("2 files");
  expect(screen.queryByText("Waiting for results.")).toBeNull();
  expect(source.close).toHaveBeenCalled();
});

it.each(["failed", "cancelled"] as const)(
  "stops polling a %s job without inventing results",
  async (status) => {
    job = {
      ...pending,
      status,
      completed_at: completed.completed_at,
      error:
        status === "failed"
          ? { code: "failed", message: "Generation failed." }
          : null,
    };
    mount(id);
    await screen.findByText(status);
    expect(screen.getByText("No results for this job.")).toBeTruthy();
    const count = requests.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });
    expect(requests.length).toBe(count);
  },
);

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
  expect(screen.getByText("succeeded")).toBeTruthy();
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
