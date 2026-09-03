import type { Metadata } from "next";

import "@/app/globals.css";
import { AppProviders } from "@/app/providers";

export const metadata: Metadata = {
  title: "Camera Path",
  description: "AI-assisted 3D camera trajectory editor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
