"use client";
import { Plus, X } from "lucide-react";
import {
  compiledTrajectory,
  playbackState,
  sceneInteraction,
} from "@camera-path/contracts/host-data";
import {
  seekPlayback,
  selectObject,
} from "@camera-path/contracts/host-requests";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import {
  ExtensionSlot,
  useData,
  useDataQuery,
  useRequestAction,
} from "@camera-path/extension-api";
import { Button } from "@camera-path/ui-kit";
import { TimelineStack } from "@camera-path/ui-kit/timeline/timeline-stack";
import { manifest } from "../manifest";
export function OverlayExtension() {
  const query = useDataQuery(manifest, compiledTrajectory);
  const playback = useData(manifest, playbackState);
  const selected =
    useData(manifest, sceneInteraction).selectedObjectId === trajectoryObjectId;
  const select = useRequestAction(manifest, selectObject);
  const seek = useRequestAction(manifest, seekPlayback);
  const trajectory = query.data?.data;
  if (!trajectory?.position_segments.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-background/90 shadow-lg backdrop-blur-md">
      <ExtensionSlot name="timeline.controls" />
      {selected && (
        <section className="border-t bg-muted/35 p-2">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold">Trajectory controls</h2>
              <span className="text-[10px] text-muted-foreground">
                {trajectory.total_length.toFixed(2)} m
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <details className="group relative hidden has-[button]:block">
                <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent">
                  <Plus className="size-3" />
                  Add effect
                </summary>
                <div className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  <ExtensionSlot name="timeline.effects" />
                </div>
              </details>
              <Button
                aria-label="Close trajectory panels"
                onClick={() =>
                  void select({ id: null, ifCurrentId: trajectoryObjectId })
                }
                size="icon"
                variant="ghost"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border bg-card">
            <TimelineStack
              pathPosition={playback.pathPosition}
              onScrub={(position) => void seek(position)}
            >
              <ExtensionSlot name="timeline.tracks" />
            </TimelineStack>
          </div>
        </section>
      )}
    </div>
  );
}
