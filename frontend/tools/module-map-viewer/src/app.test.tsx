import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App } from "./app";
import { reportFixture } from "./model/report-fixture";

afterEach(cleanup);

describe("module map viewer", () => {
  it("filters both side columns on hover, shows slots, and restores independent searches", () => {
    render(<App initialReport={reportFixture()} />);
    const selectors = screen.getByRole("region", { name: "Селекторы Zustand" });
    const actions = screen.getByRole("region", { name: "Actions" });
    const features = screen.getByRole("region", { name: "Фичи" });
    expect(screen.getAllByRole("searchbox")).toHaveLength(2);
    expect(within(features).queryByRole("searchbox")).toBeNull();
    fireEvent.change(within(selectors).getByRole("searchbox"), {
      target: { value: "camera" },
    });
    fireEvent.change(within(actions).getByRole("searchbox"), {
      target: { value: "remove" },
    });
    const alpha = screen.getByRole("button", { name: "Фича alpha" });
    fireEvent.mouseEnter(alpha);
    expect(screen.getByRole("tooltip").textContent).toContain("project.scene");
    expect(screen.getByRole("tooltip").textContent).toContain("AlphaScene");
    expect(within(actions).queryByText("remove")).toBeNull();
    expect(within(selectors).getByText("cameraAlias")).toBeTruthy();
    expect(within(features).getAllByRole("button")).toHaveLength(3);
    fireEvent.mouseLeave(alpha);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(within(actions).getByText("remove")).toBeTruthy();
    expect(within(selectors).queryByText("useTool")).toBeNull();
    expect(
      (within(actions).getByRole("searchbox") as HTMLInputElement).value,
    ).toBe("remove");
  });
  it("supports keyboard focus, empty dependencies and Escape", () => {
    render(<App initialReport={reportFixture()} />);
    const empty = screen.getByRole("button", { name: "Фича empty" });
    fireEvent.focus(empty);
    expect(screen.getByText("У этой фичи нет селекторов Zustand")).toBeTruthy();
    expect(screen.getByText("У этой фичи нет actions")).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Фича не экспортирует слоты.",
    );
    fireEvent.keyDown(empty, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByText("useTool")).toBeTruthy();
  });
  it("loads a local report, clears filters and keeps the current graph on invalid input", async () => {
    render(<App initialReport={reportFixture()} />);
    const input = screen.getByLabelText("Открыть JSON");
    fireEvent.change(input, {
      target: {
        files: [new File(["{}"], "invalid.json", { type: "application/json" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Текущая карта сохранена",
      ),
    );
    expect(screen.getByRole("button", { name: "Фича alpha" })).toBeTruthy();
    const report = reportFixture();
    report.modules = [report.modules[2]];
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Поиск: Actions" }),
      { target: { value: "move" } },
    );
    fireEvent.change(input, {
      target: {
        files: [
          new File([JSON.stringify(report)], "new-report.json", {
            type: "application/json",
          }),
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByText("new-report.json")).toBeTruthy(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Фича alpha" })).toBeNull();
    expect(
      (
        screen.getByRole("searchbox", {
          name: "Поиск: Actions",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });
});
