"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/features/theme-switcher/model/theme-provider";
import { Button } from "@/shared/ui";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
      size="icon"
      title={`Switch to ${nextTheme} theme`}
      variant="ghost"
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}
