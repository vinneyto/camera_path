"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { UserSettingsProvider } from "@/features/user-settings";
import { ThemeProvider } from "@/features/theme-switcher";

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
        <UserSettingsProvider>{children}</UserSettingsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
