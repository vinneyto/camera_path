"use client";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import { useState, type ReactNode } from "react";
/** One project owns one store and one stable set of actions. Switching projects remounts this scope. */
export function ProjectProviders({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [store] = useState(createEditorStore);
  const [actions] = useState(() => createEditorActions(store));
  return (
    <ResourceScopeProvider projectId={projectId}>
      <EditorStoreProvider store={store}>
        <EditorActionsProvider actions={actions}>
          {children}
        </EditorActionsProvider>
      </EditorStoreProvider>
    </ResourceScopeProvider>
  );
}
