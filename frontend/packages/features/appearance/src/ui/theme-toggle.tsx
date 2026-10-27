"use client";
import { Moon, Sun } from "lucide-react";

import { Button, Tooltip } from "@camera-path/ui-kit";
import { useTheme } from "@camera-path/ui-kit/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Tooltip label={`Switch to ${nextTheme} theme`}>
      <Button
        className="size-10 md:size-8"
        aria-label={`Switch to ${nextTheme} theme`}
        onClick={toggleTheme}
        size="icon"
        title={`Switch to ${nextTheme} theme`}
        variant="ghost"
      >
        {theme === "dark" ? (
          <Sun className="size-3.5" />
        ) : (
          <Moon className="size-3.5" />
        )}
      </Button>
    </Tooltip>
  );
}
