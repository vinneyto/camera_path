import type { Vec3 } from "@camera-path/types/project";

export const SCENE_GRID_SIZE = 40;
export const SCENE_GRID_DIVISIONS = 40;
export const SCENE_GRID_PLANE_ROTATION: Vec3 = [-Math.PI / 2, 0, 0];

export const SCENE_GRID_THEME = {
  dark: {
    planeColor: "#8291aa",
    lineColor: "#9baac3",
    planeOpacity: 0.045,
    lineOpacity: 0.28,
  },
  light: {
    planeColor: "#94a3b8",
    lineColor: "#526073",
    planeOpacity: 0.09,
    lineOpacity: 0.22,
  },
} as const;

export const SCENE_GRID_RENDER_ORDER = {
  webgl: { plane: -3, lines: -2 },
  webgpu: { plane: -2, lines: -1 },
} as const;
