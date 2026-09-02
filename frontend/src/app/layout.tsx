import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Camera Path",
  description: "AI-assisted 3D camera trajectory editor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
