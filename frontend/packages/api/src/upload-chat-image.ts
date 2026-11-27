import {
  createChatAttachmentUpload,
  completeChatAttachmentUpload,
} from "./client/generated/client";

export async function uploadChatImage(projectId: string, file: File) {
  const format = file.name.split(".").pop()?.toLowerCase();
  if (
    format !== "png" &&
    format !== "jpg" &&
    format !== "jpeg" &&
    format !== "webp"
  )
    throw new Error("Choose a PNG, JPEG or WebP image");
  const created = await createChatAttachmentUpload(projectId, {
    name: file.name,
    format,
    size_bytes: file.size,
  });
  if (created.status !== 201)
    throw new Error("Could not prepare the chat image");
  const upload = await fetch(created.data.upload_url, {
    method: "PUT",
    body: file,
  });
  if (!upload.ok) throw new Error("Could not upload the chat image");
  const completed = await completeChatAttachmentUpload(
    projectId,
    created.data.id,
  );
  if (completed.status !== 200)
    throw new Error("Could not validate the chat image");
  return completed.data;
}
