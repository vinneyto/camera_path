"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { Button } from "@camera-path/ui-kit";
import { LogOut } from "lucide-react";

export function ProfileAccount() {
  const auth = useAuth();
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/60 px-3 py-2.5">
        <p className="break-all text-xs font-medium">{auth.username}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Editor account</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={auth.pending}
        onClick={() => void auth.logout()}
      >
        <LogOut className="size-3.5" />
        Sign out
      </Button>
      {auth.error && (
        <p className="text-xs text-destructive" role="alert">
          {auth.error.message}
        </p>
      )}
    </div>
  );
}
