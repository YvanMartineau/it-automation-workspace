// frontend/src/components/layout/DashboardLayout.tsx
import { type ReactNode } from "react";
import { Sidebar } from "#/components/navigation/Sidebar";
import { Header } from "#/components/navigation/Header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Subtle ambient background mesh */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-mesh-light dark:bg-mesh-dark opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      </div>
      
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col relative z-10">
        <Header />
        <main id="main-content" className="min-w-0 flex-1 px-6 py-8 lg:px-8 lg:py-10" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
