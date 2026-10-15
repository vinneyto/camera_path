"use client";
import { EditorOnly } from "../ports/editor-only";
import { LibraryAssetList } from "./library-asset-list";
import { LibraryUploadForm } from "./library-upload-form";
export function LibraryContent() {
  return (
    <>
      <EditorOnly>
        <LibraryUploadForm />
      </EditorOnly>
      <LibraryAssetList />
    </>
  );
}
