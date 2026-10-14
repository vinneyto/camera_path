import { ThemeProvider } from "@host/adapters/appearance/theme-provider";
import { UserSettingsProvider } from "@host/adapters/settings";
import { ApplicationHostProvider } from "@host/runtime/application-host-provider";
// @vitest-environment happy-dom
import { ProfileControl } from "@camera-path/feature-identity/ui/profile-control";
import { AuthProvider } from "@host/adapters/identity/auth-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ThemeProvider>
          <UserSettingsProvider>
            <ApplicationHostProvider>
              <ProfileControl />
            </ApplicationHostProvider>
          </UserSettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps the sign-in modal open until a correct email code, then opens the editor menu", async () => {
  let verified = false;
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      requests.push(url);
      if (url.endsWith("/session"))
        return verified
          ? Response.json({ username: "leo@example.com" })
          : Response.json({}, { status: 401 });
      if (url.endsWith("/login")) {
        expect(JSON.parse(options.body as string)).toEqual({
          username: "leo@example.com",
          password: "secret password",
        });
        return Response.json({
          challenge_id: "pending",
          expires_in: 300,
          resend_after: 0,
        });
      }
      if (url.endsWith("/resend"))
        return Response.json({
          challenge_id: "pending",
          expires_in: 300,
          resend_after: 60,
        });
      if (url.endsWith("/verify")) {
        const body = JSON.parse(options.body as string);
        expect(body.challenge_id).toBe("pending");
        if (body.code !== "123456")
          return Response.json(
            { detail: "Invalid or expired code" },
            { status: 401 },
          );
        verified = true;
        return Response.json({ expires_in: 28800 });
      }
      throw new Error(url);
    }),
  );
  const client = mount();
  const profile = screen.getByRole("button", {
    name: "Profile",
  }) as HTMLButtonElement;
  await waitFor(() => expect(profile.disabled).toBe(false));
  fireEvent.click(profile);
  await screen.findByLabelText("Email");
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "leo@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  const code = await screen.findByLabelText("Email code");
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.change(code, { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByRole("alert");
  expect(verified).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
  await waitFor(() =>
    expect(requests.some((url) => url.endsWith("/resend"))).toBe(true),
  );
  await screen.findByRole("button", { name: /Resend in/ });
  fireEvent.change(code, { target: { value: "123456" } });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Verify code" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(verified).toBe(true);
  client.clear();
});

it("clears a pending challenge when the dialog is cancelled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/session")
        ? Response.json({}, { status: 401 })
        : Response.json({
            challenge_id: "pending",
            expires_in: 300,
            resend_after: 60,
          }),
    ),
  );
  const client = mount();
  const profile = screen.getByRole("button", {
    name: "Profile",
  }) as HTMLButtonElement;
  await waitFor(() => expect(profile.disabled).toBe(false));
  fireEvent.click(profile);
  fireEvent.change(await screen.findByLabelText("Email"), {
    target: { value: "leo@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByLabelText("Email code");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(profile);
  await screen.findByLabelText("Email");
  expect(screen.queryByLabelText("Email code")).toBeNull();
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
    "",
  );
  await act(async () => client.clear());
});
