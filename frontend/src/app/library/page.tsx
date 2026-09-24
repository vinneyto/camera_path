import Link from "next/link";

import { LibraryAssetList, LibraryUploadForm } from "@/features/library";

export default function LibraryPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <div>
        <Link
          className="text-xs text-muted-foreground hover:underline"
          href="/"
        >
          ← Projects
        </Link>
        <h1 className="mt-4 text-xl font-semibold">3DGS library</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload reconstruction files here. Projects will be able to reuse them.
        </p>
      </div>
      <LibraryUploadForm />
      <LibraryAssetList />
    </main>
  );
}
