import { useAuthStore } from "#/hooks/useAuth";
import { Button } from "#/components/ui/button";
import { LogOut, User, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function Header() {
  const { user, logout } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const displayName = user?.email?.split("@")[0] ?? "User";

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Logged in as <span className="font-medium text-foreground">{displayName}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="gap-2 text-muted-foreground hover:text-foreground"
          aria-label={`Toggle to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="text-xs capitalize">
            {mounted ? (resolvedTheme === "dark" ? "Light" : "Dark") : "Theme"}
          </span>
        </Button>

        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="capitalize">{user?.role ?? "admin"}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </header>
  );
}