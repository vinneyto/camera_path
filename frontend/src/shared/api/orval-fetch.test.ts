import { afterEach, describe, expect, it, vi } from "vitest";

import {
  forgetProjectRevision,
  orvalFetch,
  rememberProjectRevision,
} from "./orval-fetch";

const projectId = "revision-test";
const path = `/api/v1/projects/${projectId}/anchors`;

afterEach(() => {
  forgetProjectRevision(projectId);
  vi.unstubAllGlobals();
});

describe("resource revision transport", () => {
  it("sends If-Match on mutations and remembers the returned project ETag", async () => {
    rememberProjectRevision(projectId, 3);
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: "a" }), {
          status: 201,
          headers: { ETag: '"4"', "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetcher);

    const result = await orvalFetch<{ data: { id: string }; status: number }>(
      path,
      {
        method: "POST",
        body: JSON.stringify({ label: "Anchor" }),
      },
    );
    expect(new Headers(fetcher.mock.calls[0][1].headers).get("If-Match")).toBe(
      '"3"',
    );
    expect(result.data.id).toBe("a");
    await orvalFetch(path, { method: "DELETE" });
    expect(new Headers(fetcher.mock.calls[1][1].headers).get("If-Match")).toBe(
      '"4"',
    );
  });

  it("refetches a resource when a parallel read returns an older revision", async () => {
    rememberProjectRevision(projectId, 5);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("[]", { headers: { ETag: '"4"' } }))
      .mockResolvedValueOnce(
        new Response('[{"id":"a"}]', { headers: { ETag: '"5"' } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await orvalFetch<{ data: Array<{ id: string }> }>(path, {
      method: "GET",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([{ id: "a" }]);
  });
});
