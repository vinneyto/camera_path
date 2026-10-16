import {
  createEditorActions,
  createUserSettingsActions,
  UserSettingsActionsProvider,
  EditorActionsProvider,
} from "@camera-path/actions";
import {
  createEditorStore,
  createUserSettingsStore,
  UserSettingsStoreProvider,
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
  const [settingsStore] = useState(() => {
    const state = createUserSettingsStore();
    state.setState((s) => ({
      userSettings: { ...s.userSettings, loading: false, ready: true },
    }));
    return state;
  });
  const [settingsActions] = useState(() =>
    createUserSettingsActions(settingsStore),
  );
  const [store] = useState(createEditorStore);
  const [actions] = useState(() => createEditorActions(store));
  return (
    <UserSettingsStoreProvider store={settingsStore}>
      <UserSettingsActionsProvider actions={settingsActions}>
        <ResourceScopeProvider projectId={projectId}>
          <EditorStoreProvider store={store}>
            <EditorActionsProvider actions={actions}>
              {children}
            </EditorActionsProvider>
          </EditorStoreProvider>
        </ResourceScopeProvider>
      </UserSettingsActionsProvider>
    </UserSettingsStoreProvider>
  );
}
