// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryAsset } from "@/shared/api/generated/model";
import { LibraryAssetDetails } from "./library-asset-details";
import { LibraryAssetList } from "./library-asset-list";

const asset: LibraryAsset = {
  id: "asset-1",
  name: "Room",
  format: "ply",
  status: "ready",
  size_bytes: 1024,
  created_at: "2026-10-01T10:00:00Z",
  default_rotation_deg: [0, 0, 0],
  default_scale: 1,
  default_offset: [0, 0, 0],
  download_url: "http://test/room.ply",
};
let assets = [asset];
let failDelete = false;
let holdDelete = false;
let finishDelete: (() => void) | undefined;
let deleteCalls = 0;
const clients: QueryClient[] = [];

function mount(details = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      {details ? (
        <LibraryAssetDetails assetId={asset.id} />
      ) : (
        <LibraryAssetList />
      )}
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  assets = [asset];
  failDelete = false;
  holdDelete = false;
  finishDelete = undefined;
  deleteCalls = 0;
  vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      if (options.method === "DELETE") {
        deleteCalls++;
        if (holdDelete)
          await new Promise<void>((resolve) => {
            finishDelete = resolve;
          });
        if (failDelete)
          return Response.json(
            { detail: "Storage unavailable" },
            { status: 502 },
          );
        assets = [];
        return new Response(null, { status: 204 });
      }
      return Response.json(
        url.endsWith(`/library/${asset.id}`) ? asset : assets,
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("library deletion", () => {
  it("keeps only the card link and an independent delete button; cancelling does nothing", async () => {
    mount();
    const link = await screen.findByRole("link", { name: "Room" });
    expect(link.getAttribute("href")).toBe("/library/asset-1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Details")).toBeNull();
    expect(screen.queryByText("Download")).toBeNull();
    const button = screen.getByRole("button", { name: "Delete Room" });
    expect(button.closest("a")).toBeNull();
    fireEvent.click(button);
    expect(window.confirm).toHaveBeenCalledWith(
      "Delete “Room” from the library and all projects? This action cannot be undone.",
    );
    expect(deleteCalls).toBe(0);
    expect(screen.getByRole("link", { name: "Room" })).toBe(link);
  });

  it("disables repeated deletion while pending and refreshes cached project resources on success", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    holdDelete = true;
    const client = mount();
    const projectKey = ["/api/v1/projects/project-1/clouds"];
    client.setQueryData(projectKey, { data: [{ library_asset_id: asset.id }] });
    const button = await screen.findByRole("button", { name: "Delete Room" });
    fireEvent.click(button);
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(true),
    );
    expect(screen.getByText("Deleting…")).toBeDefined();
    fireEvent.click(button);
    await waitFor(() => expect(finishDelete).toBeDefined());
    expect(deleteCalls).toBe(1);
    finishDelete!();
    await screen.findByText("No files yet.");
    await waitFor(() =>
      expect(client.getQueryState(projectKey)?.isInvalidated).toBe(true),
    );
    expect(screen.queryByRole("link", { name: "Room" })).toBeNull();
  });

  it("preserves the item on a server error and allows a confirmed retry", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    failDelete = true;
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Room" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not delete",
    );
    expect(screen.getByRole("link", { name: "Room" })).toBeDefined();
    const button = screen.getByRole("button", { name: "Delete Room" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    failDelete = false;
    fireEvent.click(button);
    await screen.findByText("No files yet.");
    expect(deleteCalls).toBe(2);
  });

  it("retains Download on the asset details page", async () => {
    mount(true);
    const download = await screen.findByRole("link", { name: "Download" });
    expect(download.getAttribute("href")).toBe(asset.download_url);
    expect(download.hasAttribute("download")).toBe(true);
  });
});
