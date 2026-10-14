interface SceneMessageProps {
  message: string;
}

export function SceneMessage({ message }: SceneMessageProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background text-xs text-muted-foreground">
      {message}
    </div>
  );
}
