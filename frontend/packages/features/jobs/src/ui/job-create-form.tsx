"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useCreateJobMutation } from "@camera-path/actions";
import { Button, Card, Textarea } from "@camera-path/ui-kit";
import { parseGenerationInput } from "./parse-generation-input";

const JobInputEditor = dynamic(() => import("./job-input-editor"), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-xs text-muted-foreground">
      Loading JSON editor…
    </p>
  ),
});

const trellisTemplate = {
  id: "trellis",
  name: "Trellis · Text to 3D",
  type: "generation",
  input: { prompt: "" },
} as const;

export function JobCreateForm() {
  const router = useRouter();
  const creation = useCreateJobMutation();
  const [mode, setMode] = useState<"form" | "json">("form");
  const [source, setSource] = useState(() =>
    JSON.stringify(trellisTemplate.input, null, 2),
  );
  const { input, error } = parseGenerationInput(source);
  const busy = creation.isPending || creation.isSuccess;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !input?.prompt.trim()) return;
    creation.mutate(
      { type: trellisTemplate.type, input },
      { onSuccess: (job) => router.push(`/jobs/${job.id}`) },
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="job-template" className="block text-sm font-medium">
              Template
            </label>
            <select
              id="job-template"
              defaultValue={trellisTemplate.id}
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              <option value={trellisTemplate.id}>{trellisTemplate.name}</option>
            </select>
          </div>
          <div className="flex gap-1" role="group" aria-label="Input mode">
            <Button
              type="button"
              variant={mode === "form" ? "secondary" : "ghost"}
              aria-pressed={mode === "form"}
              disabled={!input}
              onClick={() => setMode("form")}
            >
              Form
            </Button>
            <Button
              type="button"
              variant={mode === "json" ? "secondary" : "ghost"}
              aria-pressed={mode === "json"}
              onClick={() => setMode("json")}
            >
              JSON
            </Button>
          </div>
          {mode === "form" ? (
            <div className="space-y-2">
              <label htmlFor="job-prompt" className="block text-sm font-medium">
                Prompt
              </label>
              <Textarea
                id="job-prompt"
                rows={5}
                placeholder="A small wooden chair"
                value={input?.prompt ?? ""}
                onChange={(event) =>
                  setSource(
                    JSON.stringify({ prompt: event.target.value }, null, 2),
                  )
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              <JobInputEditor
                value={source}
                onChange={setSource}
                readOnly={busy}
              />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error} Fix the JSON to return to Form.
                </p>
              )}
              {input && !input.prompt.trim() && (
                <p className="text-xs text-muted-foreground">
                  Enter a prompt to create the job.
                </p>
              )}
            </div>
          )}
        </fieldset>
        {creation.isError && (
          <p role="alert" className="text-xs text-destructive">
            Could not save the job. Try again.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !input?.prompt.trim()}>
            {busy ? "Creating…" : "Create job"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
