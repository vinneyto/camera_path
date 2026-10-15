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
export function EditorTestHost({
  children,
  projectId = "project",
}: {
  children: ReactNode;
  projectId?: string;
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
