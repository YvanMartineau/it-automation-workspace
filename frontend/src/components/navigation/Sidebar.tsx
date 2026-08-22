import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Server, UserPlus, FileText, BarChart3, Shield } from "lucide-react";
import { cn } from "#/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/assets", icon: Server, label: "Assets" },
  { to: "/onboarding", icon: UserPlus, label: "Onboarding" },
  { to: "/audit-logs", icon: FileText, label: "Audit Logs" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

export function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="flex w-64 flex-col border-r bg-card/80 backdrop-blur-sm relative z-20">
      {/* Logo area */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Shield className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground">
              IT Automation
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide uppercase font-medium">
              Internal Tools
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main navigation">
        <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Overview
        </p>
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = currentPath === to || currentPath.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive
                  ? "bg-primary/8 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <span 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary"
                  aria-hidden="true"
                />
              )}
              <Icon 
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground/70"
                )} 
                aria-hidden="true" 
              />
              <span className="truncate">{label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t px-5 py-5">
        <div className="rounded-xl bg-accent/50 border border-border/50 p-3">
          <p className="text-[11px] font-medium text-foreground">System Status</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[11px] text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
