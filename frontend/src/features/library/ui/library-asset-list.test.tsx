// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryAsset } from "@/shared/api/generated/model";
import { LibraryAssetDetails } from "./library-asset-details";
import { LibraryAssetList } from "./library-asset-list";

const room: LibraryAsset = {
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
const desk = { ...room, id: "asset-2", name: "Desk" };
const garden = { ...room, id: "asset-3", name: "Garden" };
let assets = [room, desk, garden];
let failDelete = false;
let holdDelete = false;
let finishDelete: (() => void) | undefined;
const requests: { url: string; method: string; ids: string[] }[] = [];
const clients: QueryClient[] = [];

function mount(details = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      {details ? (
        <LibraryAssetDetails assetId={room.id} />
      ) : (
        <LibraryAssetList />
      )}
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  assets = [room, desk, garden];
  failDelete = false;
  holdDelete = false;
  finishDelete = undefined;
  requests.length = 0;
  vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      if (options.method === "POST" || options.method === "DELETE") {
        const ids = JSON.parse(options.body as string).asset_ids as string[];
        requests.push({ url, method: options.method, ids });
        if (holdDelete)
          await new Promise<void>((resolve) => {
            finishDelete = resolve;
          });
        if (failDelete)
          return Response.json(
            { detail: "Storage unavailable" },
            { status: 502 },
          );
        assets = assets.filter((asset) => !ids.includes(asset.id));
        return new Response(null, { status: 204 });
      }
      return Response.json(url.endsWith("/library/" + room.id) ? room : assets);
    }),
  );
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("library selection and deletion", () => {
  it("keeps card navigation separate from checkboxes and disables deletion with an empty selection", async () => {
    mount();
    const link = await screen.findByRole("link", { name: "Room" });
    expect(link.getAttribute("href")).toBe("/library/asset-1");
    expect(screen.queryByText("Details")).toBeNull();
    expect(screen.queryByText("Download")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Room" })).toBeNull();
    const checkbox = screen.getByRole("checkbox", { name: "Select Room" });
    expect(checkbox.closest("a")).toBeNull();
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    const all = screen.getByRole("checkbox", {
      name: "Select all library files",
    }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    fireEvent.click(checkbox);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), {
      key: "Enter",
    });
    expect(
      (
        await screen.findByRole("menuitem", { name: "Delete selected" })
      ).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(requests).toHaveLength(0);
  });

  it("opens a React confirmation with names and warning, focuses Cancel and restores Actions after cancellation", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select Room" }),
    );
    const actions = screen.getByRole("button", { name: "Actions" });
    fireEvent.keyDown(actions, { key: "Enter" });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete selected" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete 1 library file?",
    });
    expect(within(dialog).getByText("Room")).toBeDefined();
    expect(dialog.textContent).toContain("removed from all projects");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(actions));
    expect(requests).toHaveLength(0);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select Room",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("deletes two selected files in one request, blocks duplicate submits and clears selection after success", async () => {
    holdDelete = true;
    const client = mount();
    const projectKey = ["/api/v1/projects/project-1/clouds"];
    client.setQueryData(projectKey, { data: [{ library_asset_id: room.id }] });
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select Room" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Desk" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete selected" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete 2 library files?",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Delete selected",
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect((confirm as HTMLButtonElement).disabled).toBe(true),
    );
    fireEvent.click(confirm);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Cancel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await waitFor(() => expect(finishDelete).toBeDefined());
    expect(requests).toEqual([
      {
        url: "/api/v1/library/bulk-delete",
        method: "POST",
        ids: [room.id, desk.id],
      },
    ]);
    finishDelete!();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("link", { name: "Garden" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Room" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Desk" })).toBeNull();
    await screen.findByText("0 selected");
    await waitFor(() =>
      expect(client.getQueryState(projectKey)?.isInvalidated).toBe(true),
    );
  });

  it("retains selection and dialog on error and retries the same batch", async () => {
    failDelete = true;
    mount();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select all library files" }),
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete selected" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete 3 library files?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete selected" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not delete",
    );
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select Room",
          hidden: true,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    failDelete = false;
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete selected" }),
    );
    await screen.findByText("No files yet.");
    expect(requests).toHaveLength(2);
    expect(requests[1].ids).toEqual(requests[0].ids);
  });

  it("retains Download on the asset details page", async () => {
    mount(true);
    const download = await screen.findByRole("link", { name: "Download" });
    expect(download.getAttribute("href")).toBe(room.download_url);
    expect(download.hasAttribute("download")).toBe(true);
  });
});

vi.mock("@/features/auth", () => ({
  EditorOnly: ({ children }: { children: React.ReactNode }) => children,
  AuthControl: () => null,
}));
