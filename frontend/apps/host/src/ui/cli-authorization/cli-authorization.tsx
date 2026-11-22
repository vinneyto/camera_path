"use client";

import { ApiError } from "@camera-path/api/client/orval-fetch";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { decideCliAuthorization } from "@camera-path/api/inference/decide-cli-authorization";
import { Slot } from "@camera-path/slots";
import { Button, Input } from "@camera-path/ui-kit";
import { useState } from "react";

export function CliAuthorization({ initialCode }: { initialCode: string }) {
  const { canEdit, loading } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(code.trim());

  async function decide(approve: boolean) {
    if (!canEdit || !valid || pending || result) return;
    setPending(true);
    setError(null);
    try {
      await decideCliAuthorization(code.trim().toUpperCase(), approve);
      setResult(approve ? "approved" : "denied");
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 404
          ? "This code is invalid or expired. Run camera-path login again for a new code."
          : reason instanceof ApiError && reason.status === 409
            ? "This code has already been used. Return to your terminal."
            : "Could not record your decision. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-5 px-5 py-12">
      <h1 className="text-xl font-semibold">Connect Camera Path CLI</h1>
      {result ? (
        <p role="status">
          {result === "approved"
            ? "Device approved. Return to the terminal to continue."
            : "Device denied. It cannot connect using this code."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Approve only if you ran camera-path login and this code matches the
            one in your terminal.
          </p>
          <div className="space-y-2">
            <label htmlFor="device-code" className="text-sm font-medium">
              Device code
            </label>
            <Input
              id="device-code"
              autoComplete="off"
              spellCheck={false}
              maxLength={9}
              value={code}
              disabled={pending}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </div>
          {loading ? (
            <p role="status">Checking your editor session…</p>
          ) : canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!valid || pending}
                onClick={() => void decide(true)}
              >
                Approve device
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!valid || pending}
                onClick={() => void decide(false)}
              >
                Deny device
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Sign in as an editor to make a decision.
              </p>
              <Slot name="profile.account" />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
