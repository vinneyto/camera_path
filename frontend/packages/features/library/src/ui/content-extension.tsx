"use client";
import { EditorOnly } from "../ports";
import { LibraryUploadForm } from "./library-upload-form";
import { LibraryAssetList } from "./library-asset-list";
export function ContentExtension() {
  return (
    <>
      <EditorOnly>
        <LibraryUploadForm />
      </EditorOnly>
      <LibraryAssetList />
    </>
  );
}
