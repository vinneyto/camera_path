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
        id: "first-lane",
        kind: "key",
        keyframes: [
          {
            ariaLabel: "First",
            id: "first",
            pathPosition: 0.25,
            tooltip: "First tooltip",
          },
        ],
        lineY: 20,
        title: "First lane",
      },
      {
        ...common,
        color: "blue",
        id: "lane",
        kind: "key",
        keyframes: [
          {
            ariaLabel: "Second",
            id: "second",
            pathPosition: 0.75,
            tooltip: "Second tooltip",
          },
        ],
        lineY: 20,
        title: "Lane",
      },
      {
        ...common,
        color: "green",
        id: "third-track",
        kind: "key",
        keyframes: [],
        lineY: 20,
        title: "Third descriptor-only track",
      },
      {
        color: "purple",
        deleteLabel: "Delete orientation keyframe",
        domain: [-10, 20],
        height: 58,
        id: "yaw",
        keyframes: [
          {
            ariaLabel: "Yaw 10 degrees",
            id: "orientation",
            pathPosition: 0.5,
            tooltip: "Yaw 10° · Pitch 2° · Roll 3° · linear",
            value: 10,
          },
        ],
        kind: "scalar",
        onDeleteKeyframe: () => undefined,
        renderMarker: () => <span data-orientation-marker />,
        samples: [
          { pathPosition: 0, value: 0 },
          { pathPosition: 1, value: 20 },
        ],
        summary: "10.0°",
        title: "Yaw",
      },
    ];

    const markup = renderToStaticMarkup(
      <TimelineStack
        onScrub={() => undefined}
        pathPosition={0.5}
        tracks={tracks}
      />,
    );

    expect(markup.match(/data-timeline-playhead/g)).toHaveLength(1);
    expect(markup.match(/data-timeline-track=/g)).toHaveLength(4);
    expect(new Set(markup.match(/data-plot-left="[^"]+"/g))).toHaveLength(1);
    expect(markup).toContain("First tooltip");
    expect(markup).toContain("Second tooltip");
    expect(markup).toContain("Third descriptor-only track");
    expect(markup).toContain("Yaw 10° · Pitch 2° · Roll 3° · linear");
    expect(markup).toContain("data-orientation-marker");
    expect(markup).not.toMatch(/>0<|>1</);
  });
});
