import type { Vec3 } from "@camera-path/types/project";

export const SCENE_LIGHT_INTENSITY = {
  dark: { ambient: 0.8, directional: 1.7 },
  light: { ambient: 1.25, directional: 2.1 },
} as const;

export const SCENE_DIRECTIONAL_LIGHT_POSITION: Vec3 = [5, 8, 4];
export const SCENE_SHADOW_MAP_SIZE: [number, number] = [1024, 1024];
