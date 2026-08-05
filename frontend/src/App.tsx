import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { DashboardLayout } from "#/components/layout/DashboardLayout";
import { AuthLayout } from "#/components/layout/AuthLayout";
import { ProtectedRoute } from "#/components/navigation/ProtectedRoute"
import { PageLoader } from "#/components/PageLoader";

// Lazy load pages for code splitting (< 200KB initial bundle)
const Login = lazy(() => import("#/pages/Login"));
const Dashboard = lazy(() => import("#/pages/Dashboard"));
const AssetIndex = lazy(() => import("#/pages/Assets/Index"));
const AssetDetail = lazy(() => import("#/pages/Assets/[id]"));
const Onboarding = lazy(() => import("#/pages/Onboarding"));
const AuditLogs = lazy(() => import("#/pages/AuditLogs"));
const Reports = lazy(() => import("#/pages/Reports"));


export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <AuthLayout>
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      </AuthLayout>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "assets", element: <AssetIndex /> },
      { path: "assets/:id", element: <AssetDetail /> },
      { path: "onboarding", element: <Onboarding /> },
      { path: "audit-logs", element: <AuditLogs /> },
      { path: "reports", element: <Reports /> },
    ],
  },
  {
    path: "*",
    element: <div className="flex h-screen items-center justify-center text-2xl font-semibold">404 — Page Not Found</div>,
  },
]);

// Need Outlet import
import { Outlet } from "react-router-dom";