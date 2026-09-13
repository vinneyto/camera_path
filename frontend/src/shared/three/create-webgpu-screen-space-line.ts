import { Line2 } from "three/addons/lines/webgpu/Line2.js";

export type WebGpuScreenSpaceLine = Line2 & { raycastThreshold: number };

export function createWebGpuScreenSpaceLine(): WebGpuScreenSpaceLine {
  const line = new Line2() as WebGpuScreenSpaceLine;
  line.raycastThreshold = 0;
  const raycast = line.raycast.bind(line);

  line.raycast = (raycaster, intersections) => {
    const previous = raycaster.params.Line2;
    raycaster.params.Line2 = { threshold: line.raycastThreshold };
    try {
      raycast(raycaster, intersections);
    } finally {
      raycaster.params.Line2 = previous;
    }
  };

  return line;
}
