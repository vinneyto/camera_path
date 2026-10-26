"use client";

import { SlotProvider } from "@camera-path/slots";
import { featureSlots } from "@host/composition/feature-slots";
import { ApplicationUi } from "@host/providers/application-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { AuthProvider } from "@camera-path/api/identity/auth-provider";
import { UserSettingsProvider } from "@host/providers/user-settings-provider";
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
            <SlotProvider features={featureSlots}>
              <ApplicationUi>{children}</ApplicationUi>
            </SlotProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
