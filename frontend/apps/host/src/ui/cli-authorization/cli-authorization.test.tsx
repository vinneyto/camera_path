// @vitest-environment happy-dom
import { SlotProvider } from "@camera-path/slots";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CliAuthorization } from "./cli-authorization";

const { auth, decide } = vi.hoisted(() => ({
  auth: { canEdit: true, loading: false },
  decide: vi.fn(),
}));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
vi.mock("@camera-path/api/inference/decide-cli-authorization", () => ({
  decideCliAuthorization: decide,
}));

beforeEach(() => {
  auth.canEdit = true;
  auth.loading = false;
  decide.mockReset();
  decide.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("requests an explicit decision after editor sign-in without losing the code", async () => {
  auth.canEdit = false;
  const view = () => (
    <SlotProvider
      features={[{ profile: { account: [() => <p>Editor form</p>] } }]}
    >
      <CliAuthorization initialCode="ABCD-2345" />
    </SlotProvider>
  );
  const { rerender } = render(view());
  expect(screen.getByText("Editor form")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve device" })).toBeNull();
  expect((screen.getByLabelText("Device code") as HTMLInputElement).value).toBe(
    "ABCD-2345",
  );
  auth.canEdit = true;
  rerender(view());
  expect(decide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Approve device" }));
  expect(await screen.findByText(/Device approved/)).toBeTruthy();
  expect(decide).toHaveBeenCalledExactlyOnceWith("ABCD-2345", true);
});

it("disables invalid codes and sends only the chosen denial", async () => {
  render(<CliAuthorization initialCode="" />);
  const deny = screen.getByRole<HTMLButtonElement>("button", {
    name: "Deny device",
  });
  expect(deny.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Device code"), {
    target: { value: "abcd2345" },
  });
  fireEvent.click(deny);
  expect(await screen.findByText(/Device denied/)).toBeTruthy();
  expect(decide).toHaveBeenCalledExactlyOnceWith("ABCD2345", false);
});
