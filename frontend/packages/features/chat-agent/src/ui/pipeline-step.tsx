"use client";
import { CheckCircle2, Circle, CircleAlert, LoaderCircle } from "lucide-react";
import type {
  ChatAttachment,
  PipelineStep as Step,
  PipelineStepRun,
} from "@camera-path/types/api";
import { ChatImage } from "./chat-image";
import { PIPELINE_PHASE_LABELS } from "../constants";

export function PipelineStep({
  step,
  run,
  onContinue,
  disabled,
}: {
  step: Step;
  run?: PipelineStepRun;
  onContinue?: (image: ChatAttachment, anchorId?: string | null) => void;
  disabled?: boolean;
}) {
  const status = run?.status ?? "pending";
  const Icon =
    status === "succeeded"
      ? CheckCircle2
      : status === "failed"
        ? CircleAlert
        : status === "running" || status === "waiting"
          ? LoaderCircle
          : Circle;
  const image = run?.output?.image as ChatAttachment | undefined;
  const anchorId = run?.output?.anchor_id as string | null | undefined;
  return (
    <li className="min-w-0 py-1">
      <div className="flex items-start gap-2">
        <Icon
          aria-hidden
          className={`mt-0.5 size-3.5 shrink-0 ${status === "running" || status === "waiting" ? "animate-spin" : ""} ${status === "succeeded" ? "text-emerald-500" : status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[11px]">
            {step.command.replaceAll("_", " ")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {(run?.phase && PIPELINE_PHASE_LABELS[run.phase]) || status}
          </p>
          {run?.error && (
            <p
              role="alert"
              className="break-words text-[11px] text-destructive"
            >
              {run.error.message}
            </p>
          )}
          {image && (
            <ChatImage
              image={image}
              disabled={disabled}
              onContinue={
                onContinue ? () => onContinue(image, anchorId) : undefined
              }
            />
          )}
        </div>
      </div>
      <details className="ml-5 mt-1 text-[10px] text-muted-foreground">
        <summary className="cursor-pointer">Parameters and result</summary>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2">
          {JSON.stringify(
            {
              input: run?.input ?? step.input,
              output: run?.output ?? null,
              job_id: run?.job_id ?? null,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </li>
  );
}
