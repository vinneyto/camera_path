import {
  completeLibraryUpload,
  createLibraryUpload,
} from "./client/generated/client";
export async function uploadLibraryFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "ply" && extension !== "sog") {
    throw new Error("Select a PLY or SOG file");
  }
  const created = await createLibraryUpload({
    name: file.name,
    format: extension,
    size_bytes: file.size,
  });
  if (created.status !== 201) throw new Error("Could not prepare the upload");
  const upload = await fetch(created.data.upload_url, {
    method: "PUT",
    body: file,
  });
  if (!upload.ok) throw new Error(`File upload failed (${upload.status})`);
  const completed = await completeLibraryUpload(created.data.id);
  if (completed.status !== 200)
    throw new Error("Could not confirm the uploaded file");
  return completed.data;
}
