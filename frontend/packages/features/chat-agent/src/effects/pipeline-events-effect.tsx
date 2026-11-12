"use client";
import { usePipelineEvents } from "@camera-path/actions";

export function PipelineEventsEffect() {
  usePipelineEvents();
  return null;
}
