import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { KeyframeTrackDescriptor } from "../model/timeline-track";
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
    const tracks: KeyframeTrackDescriptor[] = [
      {
        ...common,
        color: "red",
        id: "first-lane",
        keyframes: [{ ariaLabel: "First", id: "first", pathPosition: 0.25, tooltip: "First tooltip" }],
        lineY: 20,
        title: "First lane",
      },
      {
        ...common,
        color: "blue",
        id: "lane",
        keyframes: [{ ariaLabel: "Second", id: "second", pathPosition: 0.75, tooltip: "Second tooltip" }],
        lineY: 20,
        title: "Lane",
      },
      {
        ...common,
        color: "green",
        id: "third-track",
        keyframes: [],
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
    expect(markup).not.toMatch(/>0<|>1</);
  });
});
