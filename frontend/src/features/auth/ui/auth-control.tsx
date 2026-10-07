"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Modal } from "@/shared/ui";
import { UserSettingsPanel } from "@/features/user-settings/ui/user-settings-panel";
import { SignOutButton } from "./sign-out-button";
import { useAuth } from "../model/auth-provider";

export function AuthControl() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await auth.login(username, password);
      setPassword("");
      setOpen(false);
    } catch {
      setPassword("");
    }
  }

  if (auth.username) {
    return (
      <UserSettingsPanel>
        <SignOutButton />
      </UserSettingsPanel>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPassword("");
      }}
      title="Editor sign in"
      trigger={
        <Button
          disabled={auth.loading || auth.pending}
          size="sm"
          variant="outline"
        >
          Sign in
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs">
          Username
          <Input
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="block text-xs">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={auth.pending} size="sm">
            {auth.pending ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setPassword("");
            }}
          >
            Cancel
          </Button>
        </div>
        {auth.error && (
          <p className="text-xs text-destructive" role="alert">
            {auth.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
