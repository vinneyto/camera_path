"use client";
import { useSceneModels } from "@camera-path/api/resources";
import { useEffect, useRef } from "react";
import { useEditorActions } from "../../actions-provider";

/** Track logical deletion, independently of renderer/node mount lifetimes. */
export function useSceneObjectLifecycle() {
  const { data, isSuccess } = useSceneModels();
  const actions = useEditorActions();
  const previous = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isSuccess || !data) return;
    const current = new Set(data.data.map((object) => object.id));
    if (previous.current)
      actions.clearRemovedSceneObjects(
        [...previous.current].filter((id) => !current.has(id)),
      );
    previous.current = current;
  }, [actions, data, isSuccess]);
}
