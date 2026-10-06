"use client";

import { useState, type FormEvent } from "react";

import { Button, Input } from "@/shared/ui";
import { useUploadLibraryFile } from "../api/use-upload-library-file";

export function LibraryUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadLibraryFile();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    try {
      await upload.mutateAsync(file);
      setFile(null);
      form.reset();
    } catch {
      // The mutation error is displayed below the form.
    }
  }

  return (
    <form className="space-y-2 rounded-lg border p-4" onSubmit={submit}>
      <label className="block text-xs font-medium" htmlFor="library-file">
        Add a PLY file to the library
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          accept=".ply"
          className="min-w-0 flex-1"
          id="library-file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <Button disabled={!file || upload.isPending} type="submit">
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {upload.error && (
        <p className="text-xs text-destructive" role="alert">
          {upload.error.message}
        </p>
      )}
    </form>
  );
}
