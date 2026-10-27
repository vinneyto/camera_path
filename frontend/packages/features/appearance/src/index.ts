import type { FeatureSlots } from "@camera-path/slots";
import { ThemeToggle } from "./ui/theme-toggle";

export const slots = {
  navigation: {
    controls: [ThemeToggle],
  },
} as const satisfies FeatureSlots;
