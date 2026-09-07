import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TimelineTrackDescriptor } from "../model/timeline-track";
import { TimelineStack } from "./timeline-stack";

describe("TimelineStack", () => {
  it("renders any number of descriptors with one aligned playhead and independent tooltips", () => {
    const common = {
      deleteLabel: "Delete keyframe",
      height: 40,
      onDeleteKeyframe: () => undefined,
      renderMarker: () => <span data-marker />,
      summary: "1 key",
    };
    const tracks: TimelineTrackDescriptor[] = [
      {
        ...common,
        color: "red",
        domain: [0, 1],
        id: "scalar",
        keyframes: [{ ariaLabel: "First", id: "first", pathPosition: 0.25, tooltip: "First tooltip", value: 0.5 }],
        kind: "scalar",
        samples: [{ pathPosition: 0, value: 0 }, { pathPosition: 1, value: 1 }],
        title: "Scalar",
        yAxisLabel: "Value",
      },
      {
        ...common,
        color: "blue",
        emptyState: null,
        id: "lane",
        keyframes: [{ ariaLabel: "Second", id: "second", pathPosition: 0.75, tooltip: "Second tooltip" }],
        kind: "key-lane",
        lineY: 20,
        title: "Lane",
      },
      {
        ...common,
        color: "green",
        emptyState: "No events",
        id: "third-track",
        keyframes: [],
        kind: "key-lane",
        lineY: 20,
        title: "Third descriptor-only track",
      },
    ];

    const markup = renderToStaticMarkup(
      <TimelineStack onScrub={() => undefined} pathPosition={0.5} tracks={tracks} />,
    );

    expect(markup.match(/data-timeline-playhead/g)).toHaveLength(1);
    expect(markup.match(/data-timeline-track=/g)).toHaveLength(3);
    expect(new Set(markup.match(/data-plot-left="[^"]+"/g))).toHaveLength(1);
    expect(markup).toContain("First tooltip");
    expect(markup).toContain("Second tooltip");
    expect(markup).toContain("Third descriptor-only track");
  });
});
