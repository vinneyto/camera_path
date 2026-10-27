import { Slot } from "@camera-path/slots";

export default function LibraryPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <div>
        <h1 className="text-xl font-semibold">3DGS library</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload reconstruction files here. Projects will be able to reuse them.
        </p>
      </div>
      <Slot name="library.content" />
    </main>
  );
}
