"use client";
import { Slot } from "@camera-path/slots";

export function ProjectListPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Camera Path
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a saved scene or start a new trajectory.
          </p>
        </div>
      </div>
      <Slot name="dashboard.content" />
    </main>
  );
}
