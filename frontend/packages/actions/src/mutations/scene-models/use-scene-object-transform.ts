"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorActions } from "../../actions-provider";
import { useSceneObjectActions } from "./use-scene-object-actions";
import type {
  SceneObjectTransform,
  SceneObjectTransformDraft,
  SceneObjectTransformInteraction,
} from "@camera-path/types/scene-object-transform";

export function useSceneObjectTransform(): SceneObjectTransformInteraction & {
  error: Error | null;
} {
  const mutation = useSceneObjectActions();
  const { setActiveTool, finishObjectTransform } = useEditorActions();
  const session = useRef<{ id: string; saving: boolean } | null>(null);
  const [preview, setPreview] = useState<SceneObjectTransformDraft | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(
    () => () => {
      const owned = session.current;
      session.current = null;
      if (owned && !owned.saving) finishObjectTransform();
    },
    [finishObjectTransform],
  );
  function begin(id: string, transform: SceneObjectTransform) {
    if (session.current !== null) return;
    session.current = { id, saving: false };
    setError(null);
    setPreview({ id, transform });
    setActiveTool("object-transform");
  }
  function change(id: string, transform: SceneObjectTransform) {
    if (session.current?.id === id && !session.current.saving)
      setPreview({ id, transform });
  }
  function cancel(id: string) {
    if (session.current?.id !== id || session.current.saving) return;
    session.current = null;
    setPreview(null);
    finishObjectTransform();
  }
  function commit(id: string, transform: SceneObjectTransform) {
    const current = session.current;
    if (current?.id !== id || current.saving) return;
    current.saving = true;
    setPending(true);
    setPreview({ id, transform });
    finishObjectTransform();
    void mutation
      .mutateAsync({
        type: "update",
        cloudId: id,
        changes: {
          position: transform.position,
          quaternion: transform.quaternion,
        },
      })
      .catch((reason: unknown) => {
        if (session.current === current)
          setError(
            reason instanceof Error ? reason : new Error(String(reason)),
          );
      })
      .finally(() => {
        if (session.current !== current) return;
        session.current = null;
        setPreview(null);
        setPending(false);
      });
  }
  return { preview, pending, error, begin, change, commit, cancel };
}
