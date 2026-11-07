"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCreateImageJobMutation } from "@camera-path/actions";
import { Button, Card, Input } from "@camera-path/ui-kit";
import { ImageFilePreview } from "./image-file-preview";
import { parseImageGenerationInput } from "./parse-image-generation-input";

const JobInputEditor = dynamic(() => import("./job-input-editor"), {
  ssr: false,
});

export function ImageJobCreateForm() {
  const router = useRouter();
  const creation = useCreateImageJobMutation();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [source, setSource] = useState('{"image_asset_id": ""}');
  const { input, error } = parseImageGenerationInput(source);
  const fileError =
    file &&
    (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 20 * 1024 * 1024)
      ? "Select a PNG, JPEG or WebP image up to 20 MB."
      : null;
  const ready = mode === "form" ? !!file && !fileError : !!input;
  const busy = creation.isPending || creation.isSuccess;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    creation.mutate(
      mode === "form" && file
        ? { file }
        : { imageAssetId: input?.image_asset_id },
      {
        onSuccess: (job) => router.push(`/jobs/${job.id}`),
      },
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="flex gap-1" role="group" aria-label="Input mode">
            <Button
              type="button"
              variant={mode === "form" ? "secondary" : "ghost"}
              aria-pressed={mode === "form"}
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
            <div className="space-y-3">
              <label htmlFor="job-image" className="block text-sm font-medium">
                Source image
              </label>
              <Input
                id="job-image"
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  creation.reset();
                }}
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPEG or WebP · up to 20 MB. The original is saved in the
                library. Background removal runs automatically when needed.
              </p>
              {fileError && (
                <p role="alert" className="text-xs text-destructive">
                  {fileError}
                </p>
              )}
              {file && !fileError && <ImageFilePreview file={file} />}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Use the ID of an image already in the library, or return to Form
                to upload a new image.
              </p>
              <JobInputEditor
                value={source}
                onChange={setSource}
                readOnly={busy}
              />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </fieldset>
        {creation.isError && (
          <p role="alert" className="text-xs text-destructive">
            {creation.error.message}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !ready}>
            {busy ? "Uploading and queuing…" : "Create and generate"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
