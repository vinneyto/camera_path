"use client";

import { UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button, DropdownMenu, Input, Modal } from "@/shared/ui";
import { useAuth } from "../model/auth-provider";

export function ProfileControl() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expiresSeconds, setExpiresSeconds] = useState(0);
  useEffect(() => {
    if (!auth.challenge) return;
    const started = Date.now();
    const update = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setResendSeconds(Math.max(0, auth.challenge!.resend_after - elapsed));
      setExpiresSeconds(Math.max(0, auth.challenge!.expires_in - elapsed));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [auth.challenge]);
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
      if (auth.challenge) {
        await auth.verify(code);
        setCode("");
        setOpen(false);
      } else if (await auth.login(username, password)) setOpen(false);
      setPassword("");
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
        if (auth.pending) return;
        setOpen(next);
        if (!next) {
          setPassword("");
          setCode("");
          auth.cancelLogin();
        }
      }}
      title="Editor sign in"
      trigger={trigger}
    >
      <form onSubmit={submit} className="space-y-4">
        {auth.challenge ? (
          <div className="space-y-3">
            <p className="text-xs">
              Enter the code sent to your email. Expires in {expiresSeconds}s.
            </p>
            <Input
              aria-label="Email code"
              placeholder="Email code"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              className="h-10 text-base md:h-8 md:text-xs"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                auth.pending || resendSeconds > 0 || expiresSeconds === 0
              }
              onClick={() => {
                setCode("");
                void auth.resend().catch(() => {});
              }}
            >
              {resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Resend code"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={auth.pending}
              onClick={() => {
                setCode("");
                auth.cancelLogin();
              }}
            >
              Start again
            </Button>
          </div>
        ) : (
          <>
            <Input
              aria-label="Email"
              placeholder="Email"
              type="email"
              autoComplete="username"
              className="h-10 text-base md:h-8 md:text-xs"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              aria-label="Password"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              className="h-10 text-base md:h-8 md:text-xs"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              auth.pending || (!!auth.challenge && expiresSeconds === 0)
            }
            size="sm"
          >
            {auth.pending
              ? "Signing in…"
              : auth.challenge
                ? "Verify code"
                : "Sign in"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={auth.pending}
            onClick={() => {
              setOpen(false);
              setPassword("");
              setCode("");
              auth.cancelLogin();
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
