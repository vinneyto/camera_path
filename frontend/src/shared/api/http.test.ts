import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./http";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a successful response without a JSON body", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json,
      ok: true,
      status: 204,
    }));

    await expect(apiRequest<void>("/projects/project-1", { method: "DELETE" })).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
