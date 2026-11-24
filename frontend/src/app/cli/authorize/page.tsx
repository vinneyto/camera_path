import type { Metadata } from "next";
import { CliAuthorization } from "@host/ui/cli-authorization/cli-authorization";

export const metadata: Metadata = {
  title: "Connect Camera Path CLI",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function CliAuthorizationPage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string | string[] }>;
}) {
  const { user_code } = await searchParams;
  const code =
    typeof user_code === "string" &&
    /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(user_code)
      ? user_code.toUpperCase()
      : "";
  return <CliAuthorization initialCode={code} />;
}
