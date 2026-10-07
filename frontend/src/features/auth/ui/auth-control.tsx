"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@/shared/ui";
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
    <div className="relative">
      <Button
        disabled={auth.loading || auth.pending}
        onClick={() => setOpen(!open)}
        size="sm"
        variant="outline"
      >
        Sign in
      </Button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-full z-50 mt-2 w-72 space-y-3 rounded-lg border bg-background p-4 shadow-lg"
        >
          <h2 className="text-sm font-semibold">Editor sign in</h2>
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
        </form>
      )}
      {auth.error && (
        <p className="text-xs text-destructive" role="alert">
          {auth.error.message}
        </p>
      )}
    </div>
  );
}
