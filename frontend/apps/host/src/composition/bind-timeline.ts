import type { TimelineContribution } from "@camera-path/contracts/timeline-contribution";
import type { TimelineInputs } from "./timeline-inputs";
export function bindTimeline<T>(
  contribution: TimelineContribution<T>,
  project: (input: TimelineInputs) => T,
): TimelineContribution<TimelineInputs> {
  return {
    id: contribution.id,
    createTrack: contribution.createTrack
      ? (input) => contribution.createTrack!(project(input))
      : undefined,
    render: contribution.render
      ? (input) => contribution.render!(project(input))
      : undefined,
    effect: contribution.effect
      ? {
          label: contribution.effect.label,
          available: (input) => contribution.effect!.available(project(input)),
          disabled: (input) => contribution.effect!.disabled(project(input)),
          run: (input) => contribution.effect!.run(project(input)),
        }
      : undefined,
  };
}
