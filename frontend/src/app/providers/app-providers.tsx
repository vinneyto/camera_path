"use client";

import { ApplicationUi } from "@host/providers/application-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { AuthProvider } from "@camera-path/api/identity/auth-provider";
import { UserSettingsProvider } from "@camera-path/api/settings";
import { ThemeProvider } from "@camera-path/ui-kit/theme/theme-provider";

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
            <ApplicationUi>{children}</ApplicationUi>
          </UserSettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
