"use client";
import { useState } from "react";
import { Copy, Workflow } from "lucide-react";
import type { ChatAttachment, Pipeline } from "@camera-path/types/api";
import { Button } from "@camera-path/ui-kit";
import { PipelineStep } from "./pipeline-step";

export function PipelineCard({
  pipeline,
  onConfirm,
  onContinue,
  disabled,
}: {
  pipeline: Pipeline;
  onConfirm?: (id: string) => void;
  onContinue?: (image: ChatAttachment, anchorId?: string | null) => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(label: string, data: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(label);
    } catch {
      setCopied("Could not copy; select the JSON below");
    }
  }
  return (
    <section
      aria-label={pipeline.definition.title}
      className="mx-3 my-2 min-w-0 rounded-lg border bg-muted/20 p-2.5"
    >
      <div className="mb-2 flex items-start gap-2">
        <Workflow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-xs font-medium">
            {pipeline.definition.title}
          </h3>
          <p role="status" className="text-[10px] text-muted-foreground">
            {pipeline.status.replaceAll("_", " ")}
          </p>
        </div>
      </div>
      <ol className="divide-y">
        {pipeline.definition.steps.map((step) => (
          <PipelineStep
            key={step.id}
            step={step}
            run={pipeline.steps.find((s) => s.id === step.id)}
            onContinue={onContinue}
            disabled={disabled}
          />
        ))}
      </ol>
      {pipeline.status === "awaiting_confirmation" && onConfirm && (
        <Button
          type="button"
          size="sm"
          className="mt-2 h-7 w-full text-[11px]"
          disabled={disabled}
          onClick={() => onConfirm(pipeline.id)}
        >
          Confirm and run
        </Button>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => void copy("Definition copied", pipeline.definition)}
        >
          <Copy className="size-3" /> Copy definition
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => void copy("Execution JSON copied", pipeline)}
        >
          <Copy className="size-3" /> Copy execution JSON
        </button>
      </div>
      {copied && (
        <p role="status" className="mt-1 text-[10px] text-muted-foreground">
          {copied}
        </p>
      )}
      <details className="mt-2 text-[10px] text-muted-foreground">
        <summary className="cursor-pointer">Execution JSON</summary>
        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words">
          {JSON.stringify(pipeline, null, 2)}
        </pre>
      </details>
    </section>
  );
}
