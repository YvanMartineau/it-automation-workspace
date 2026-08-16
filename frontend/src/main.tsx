import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "#/components/layout/ThemeProvider";
import { Toaster } from "#/components/ui/sonner";
import { AuthBootstrapGate } from "#/components/navigation/AuthBootstrapGate";
import { router } from "#/App";
import "#/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,        // 30s default
      gcTime: 1000 * 60 * 5,       // 5m cache (v5: gcTime, not cacheTime)
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors
        if (error instanceof Error && error.message.includes("4")) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="it-dashboard-theme" attribute="class" enableSystem={true} disableTransitionOnChange={false}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrapGate>
          <RouterProvider router={router} />
        </AuthBootstrapGate>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={4000}
          visibleToasts={5}
          expand
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);