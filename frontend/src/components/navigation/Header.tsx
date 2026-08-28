import { useAuthStore } from "#/hooks/useAuth";
import { Button } from "#/components/ui/button";
import { LogOut, User, Sun, Moon, Bell, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
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
    <header className="glass-header sticky top-0 z-40 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        Skip to main content
      </a>

      <div className="flex items-center gap-2">
        {/* Hamburger — mobile/tablet only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </Button>

        {/* Breadcrumb / Context */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">IT Automation</span>
          <span className="text-muted-foreground/40">/</span>
          <span>Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
          aria-label={`Toggle to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
            )
          ) : (
            <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
        </Button>

        {/* Divider — hidden on smallest screens to save space */}
        <div className="hidden xs:block h-6 w-px bg-border mx-1" aria-hidden="true" />

        {/* User pill */}
        <div className="flex items-center gap-3 rounded-full bg-accent/60 border border-border/50 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-xs font-medium text-foreground">{displayName}</span>
            <span className="text-[10px] text-muted-foreground capitalize mt-0.5">{user?.role ?? "admin"}</span>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="gap-2 text-muted-foreground hover:text-danger hover:bg-danger/5 rounded-full px-3 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline text-xs">Logout</span>
        </Button>
      </div>
    </header>
  );
}