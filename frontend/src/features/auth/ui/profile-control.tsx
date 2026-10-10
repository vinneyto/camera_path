"use client";

import { UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button, DropdownMenu, Input, Modal } from "@/shared/ui";
import { useAuth } from "../model/auth-provider";

export function ProfileControl() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const trigger = (
    <Button
      aria-label="Profile"
      className="size-10 md:size-8"
      disabled={auth.loading || auth.pending}
      size="icon"
      title={auth.username ? `Profile: ${auth.username}` : "Sign in"}
      variant="ghost"
    >
      <UserRound className="size-4" />
    </Button>
  );

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

  if (auth.canEdit) {
    return (
      <div className="relative">
        <DropdownMenu
          trigger={trigger}
          items={[
            {
              label: auth.username ?? "Profile",
              onSelect: () => {},
              disabled: true,
            },
            {
              label: "Sign out",
              onSelect: () => void auth.logout(),
              disabled: auth.pending,
            },
          ]}
        />
        {auth.error && (
          <p
            className="absolute right-0 top-full w-60 rounded-md border bg-popover p-2 text-xs text-destructive shadow-lg"
            role="alert"
          >
            {auth.error.message}
          </p>
        )}
      </div>
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
      trigger={trigger}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs">
          Username
          <Input
            autoComplete="username"
            className="h-10 text-base md:h-8 md:text-xs"
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
            className="h-10 text-base md:h-8 md:text-xs"
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
