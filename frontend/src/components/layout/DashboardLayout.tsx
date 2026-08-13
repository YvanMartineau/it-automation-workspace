// frontend/src/components/layout/DashboardLayout.tsx
import { type ReactNode } from "react";
import { Sidebar } from "#/components/navigation/Sidebar";
import { Header } from "#/components/navigation/Header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main-content" className="min-w-0 flex-1 px-6 py-8" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}