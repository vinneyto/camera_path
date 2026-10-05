"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useGaussianRenderingSettingsStore } from "@/features/gaussian-rendering-settings";
import { ThemeProvider } from "@/features/theme-switcher";

export function AppProviders({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    void useGaussianRenderingSettingsStore.persist.rehydrate();
  }, []);
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
