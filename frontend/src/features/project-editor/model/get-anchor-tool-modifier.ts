interface ModifierEvent {
  ctrlKey: boolean;
  metaKey: boolean;
}

export function getAnchorToolModifier(
  event: ModifierEvent,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  const isApplePlatform = /Macintosh|Mac OS|iPhone|iPad|iPod/.test(userAgent);
  return {
    key: isApplePlatform ? "Meta" : "Control",
    pressed: isApplePlatform ? event.metaKey : event.ctrlKey,
  } as const;
}
