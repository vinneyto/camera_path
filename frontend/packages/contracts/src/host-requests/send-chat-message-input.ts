export interface SendChatMessageInput {
  id: string;
  message: string;
  onAccepted: () => void;
}
