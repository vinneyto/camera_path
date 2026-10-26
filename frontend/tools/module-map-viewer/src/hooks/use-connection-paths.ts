import { useLayoutEffect, useState, type RefObject } from "react";
import { linkHorizontal } from "d3-shape";
import type { GraphLink } from "../model/types";

export function useConnectionPaths(
  container: RefObject<HTMLDivElement | null>,
  links: GraphLink[],
) {
  const [paths, setPaths] = useState<(GraphLink & { path: string })[]>([]);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    const shape = linkHorizontal();
    function measure() {
      const origin = element!.getBoundingClientRect();
      const anchors = new Map<
        string,
        { left: number; right: number; y: number }
      >();
      for (const node of element!.querySelectorAll<HTMLElement>(
        "[data-node-id]",
      )) {
        const rect = node.getBoundingClientRect();
        const clip = node.closest(".lane-body")!.getBoundingClientRect();
        const y = (rect.top + rect.bottom) / 2;
        if (rect.width > 0 && y >= clip.top && y <= clip.bottom)
          anchors.set(node.dataset.nodeId!, {
            left: rect.left - origin.left,
            right: rect.right - origin.left,
            y: y - origin.top,
          });
      }
      setPaths(
        links.flatMap((link) => {
          const from = anchors.get(link.source),
            to = anchors.get(link.target);
          if (!from || !to) return [];
          const path = shape({
            source: [from.right + 1, from.y],
            target: [to.left - 1, to.y],
          });
          return path ? [{ ...link, path }] : [];
        }),
      );
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element
      .querySelectorAll("[data-node-id], .lane-body")
      .forEach((node) => observer.observe(node));
    element.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [container, links]);
  return paths;
}
