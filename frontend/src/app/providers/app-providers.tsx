"use client";

import { ApplicationHostProvider } from "@host/runtime/application-host-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ThemeProvider } from "@host/adapters/appearance/theme-provider";
import { AuthProvider } from "@host/adapters/identity/auth-provider";
import { UserSettingsProvider } from "@host/adapters/settings";

export function AppProviders({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 10_000,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UserSettingsProvider>
            <ApplicationHostProvider>{children}</ApplicationHostProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
