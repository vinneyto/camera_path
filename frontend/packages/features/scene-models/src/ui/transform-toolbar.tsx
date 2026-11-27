"use client";
import { useEditorActions } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useCameraState,
  useEditorTool,
  useSceneInteraction,
} from "@camera-path/store";
import { Button } from "@camera-path/ui-kit";
import { Move3D, Rotate3D } from "lucide-react";

export function TransformToolbar() {
  const { canEdit } = useAuth();
  const { widget } = useSceneInteraction();
  const { cameraMode } = useCameraState();
  const { activeTool } = useEditorTool();
  const { setSceneWidget } = useEditorActions();
  if (!canEdit) return null;
  const disabled = cameraMode !== "orbit" || activeTool !== null;
  return (
    <div role="group" aria-label="Object transform mode" className="flex gap-1">
      <Button
        aria-label="Move object"
        title="Move object"
        aria-pressed={widget === "position"}
        disabled={disabled}
        onClick={() => setSceneWidget("position")}
        size="sm"
        variant={widget === "position" ? "default" : "outline"}
      >
        <Move3D className="size-3.5" />
      </Button>
      <Button
        aria-label="Rotate object"
        title="Rotate object"
        aria-pressed={widget === "rotation"}
        disabled={disabled}
        onClick={() => setSceneWidget("rotation")}
        size="sm"
        variant={widget === "rotation" ? "default" : "outline"}
      >
        <Rotate3D className="size-3.5" />
      </Button>
    </div>
  );
}
