import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineRequest } from "../define-request";
import { valueSchema } from "../value-schema";
import type { SendChatMessageInput } from "./send-chat-message-input";
export const sendChatMessage = defineRequest(
  "host.chat.send@1",
  "Send a message to the trajectory agent and return the resulting trajectory.",
  valueSchema(
    (v): v is SendChatMessageInput =>
      !!v &&
      typeof v === "object" &&
      "id" in v &&
      typeof v.id === "string" &&
      "message" in v &&
      typeof v.message === "string" &&
      "onAccepted" in v &&
      typeof v.onAccepted === "function",
    "chat request",
  ),
  apiSchema<Api.ChatResponse>("ChatResponse"),
);
