import { Link } from "react-router-dom";
import { LayoutDashboard, Server, UserPlus, FileText, BarChart3 } from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/assets", icon: Server, label: "Assets" },
  { to: "/onboarding", icon: UserPlus, label: "Onboarding" },
  { to: "/audit-logs", icon: FileText, label: "Audit Logs" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r bg-card px-4 py-6">
      <div className="mb-8 px-2">
        <h1 className="text-lg font-semibold tracking-tight">IT Automation</h1>
        <p className="text-xs text-muted-foreground">Internal Tools</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}