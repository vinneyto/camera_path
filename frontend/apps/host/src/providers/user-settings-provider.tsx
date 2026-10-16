"use client";
import {
  createUserSettingsActions,
  UserSettingsActionsProvider,
} from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  createUserSettingsStore,
  UserSettingsStoreProvider,
} from "@camera-path/store";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

/** Host owns one settings store/action set for the whole application. */
export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createUserSettingsStore);
  const [actions] = useState(() => createUserSettingsActions(store));
  const { canEdit } = useAuth();
  useLayoutEffect(() => {
    actions.setCanEdit(canEdit);
  }, [actions, canEdit]);
  useEffect(() => {
    void actions.load();
    return actions.cancel;
  }, [actions]);
  return (
    <UserSettingsStoreProvider store={store}>
      <UserSettingsActionsProvider actions={actions}>
        {children}
      </UserSettingsActionsProvider>
    </UserSettingsStoreProvider>
  );
}
