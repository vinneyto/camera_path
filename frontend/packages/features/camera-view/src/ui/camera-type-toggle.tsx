"use client";
import { useEditorActions } from "@camera-path/actions";
import { useCameraState } from "@camera-path/store";
import { Button } from "@camera-path/ui-kit";
import { Orbit, Plane } from "lucide-react";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";

export function CameraTypeToggle() {
  const { cameraType } = useCameraState();
  const { setCameraType } = useEditorActions();
  const viewport = useViewportServices();
  return (
    <div role="group" aria-label="Navigation camera" className="flex gap-1">
      {(["orbit", "freeFlight"] as const).map((type) => {
        const selected = cameraType === type;
        const label = type === "orbit" ? "OrbitControl" : "FreeFlight";
        const Icon = type === "orbit" ? Orbit : Plane;
        return (
          <Button
            key={type}
            aria-label={label}
            aria-pressed={selected}
            title={label}
            size="sm"
            variant={selected ? "default" : "outline"}
            className={
              selected
                ? "shadow-sm"
                : "bg-background/85 text-foreground shadow-sm backdrop-blur"
            }
            onClick={() => {
              viewport.closeMenu();
              setCameraType(type);
            }}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
