"use client";

import { Button } from "@/shared/ui";
import { useAuth } from "../model/auth-provider";

export function SignOutButton() {
  const auth = useAuth();

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Button
        className="w-full justify-start"
        disabled={auth.pending}
        onClick={() => void auth.logout()}
        size="sm"
        variant="ghost"
      >
        {auth.pending ? "Signing out…" : "Sign out"}
      </Button>
      {auth.error && (
        <p className="text-xs text-destructive" role="alert">
          {auth.error.message}
        </p>
      )}
    </div>
  );
}
