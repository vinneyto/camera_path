import type { FeatureSlots } from "@camera-path/slots";
import { ScanSearch } from "lucide-react";
import { SiftPage } from "./ui/sift-page";
export const slots = {
  pages: [
    { path: "/sift", label: "SIFT lab", icon: ScanSearch, component: SiftPage },
  ],
} as const satisfies FeatureSlots;
