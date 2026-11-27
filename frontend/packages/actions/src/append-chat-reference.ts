export function appendChatReference(message: string, name: string) {
  const label = name.trim();
  if (!label) return message;
  return `${message}${message && !/\s$/.test(message) ? " " : ""}@${label} `;
}
