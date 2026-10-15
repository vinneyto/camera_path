import { describe, expect, it } from "vitest";
import bundledReport from "../../../../docs/frontend-modules.json";
import { reportFixture } from "./report-fixture";
import { parseReport } from "./parse-report";
import { buildGraph } from "./build-graph";
import { filterGraph } from "./filter-graph";
import { flattenSlots } from "./flatten-slots";

describe("report graph", () => {
  it("reads the actual generated report", () => {
    const report = parseReport(bundledReport);
    expect(buildGraph(report).features).toHaveLength(
      report.modules.filter((m) => m.kind === "feature").length,
    );
  });
  it("merges symbol aliases, excludes API/shared/host, and preserves every feature link", () => {
    const report = reportFixture();
    report.modules[0].selectors.push({
      ...report.modules[0].selectors[0],
      name: "useApi",
      package: "@camera-path/api",
      kind: "api-hook",
    });
    report.modules[0].selectors.push({
      ...report.modules[0].selectors[0],
      name: "useProjectId",
      kind: "store-hook",
      statePaths: [],
    });
    const graph = buildGraph(report);
    expect(graph.features.map((f) => f.label)).toEqual([
      "alpha",
      "beta",
      "empty",
    ]);
    expect(graph.selectors).toHaveLength(2);
    expect(
      graph.selectors.find((s) => s.names.includes("useCamera"))?.names,
    ).toEqual(["cameraAlias", "useCamera"]);
    expect(graph.links).toHaveLength(5);
    expect(new Set(graph.links.map((l) => l.id)).size).toBe(5);
  });
  it("combines independent case-insensitive searches with hover and restores the search result", () => {
    const graph = buildGraph(reportFixture());
    const alpha = graph.features[0].id;
    expect(
      filterGraph(graph, " USECAMERA ", "REMOVE", null).links,
    ).toHaveLength(3);
    const active = filterGraph(graph, "camera", "remove", alpha);
    expect(active.selectors).toHaveLength(1);
    expect(active.actions).toHaveLength(0);
    expect(active.links.every((l) => l.featureId === alpha)).toBe(true);
    expect(filterGraph(graph, "camera", "remove", null).actions).toHaveLength(
      1,
    );
    expect(filterGraph(graph, "", "", graph.features[2].id).links).toEqual([]);
  });
  it("preserves nested slot paths and mounting order", () => {
    expect(
      flattenSlots(reportFixture().modules[0].slots).map((s) => [
        s.path,
        s.components.map((c) => c.name),
      ]),
    ).toEqual([["project.scene", ["AlphaScene", "AlphaPass"]]]);
  });
  it.each([
    null,
    { schemaVersion: 2, modules: [] },
    {
      ...reportFixture(),
      modules: [{ ...reportFixture().modules[0], actions: [{}] }],
    },
    {
      ...reportFixture(),
      modules: [{ ...reportFixture().modules[0], slots: { scene: ["Bad"] } }],
    },
    {
      ...reportFixture(),
      modules: [reportFixture().modules[0], reportFixture().modules[0]],
    },
  ])("rejects incompatible or malformed reports", (value) =>
    expect(() => parseReport(value)).toThrow(),
  );
});
