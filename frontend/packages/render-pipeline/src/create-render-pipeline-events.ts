import { events, type RootStore } from "@react-three/fiber";

import { sortRenderPipelineIntersections } from "./sort-render-pipeline-intersections";

export function createRenderPipelineEvents(store: RootStore) {
  return {
    ...events(store),
    filter: sortRenderPipelineIntersections,
  };
}
