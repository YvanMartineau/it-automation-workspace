/**
 * @fileoverview IT Automation Dashboard — Main Overview Page.
 * High-signal metrics, health trends, OS distribution, onboarding volume,
 * recent audit activity, and quick actions. Built with strict TypeScript,
 * zero any types, and full WCAG 2.1 AA accessibility.
 *
 * @todo Replace mock data imports with TanStack Query hooks once backend is ready.
 */

import { useMemo } from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '#/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card';
import { Badge } from '#/components/ui/badge';
import { StatsCard } from '#/components/data-display/StatsCard';
import { HealthTrendChart } from '#/components/data-display/HealthTrendChart';
import { OSDistributionChart } from '#/components/data-display/OSDistributionChart';
import { OnboardingVolumeChart } from '#/components/data-display/OnboardingVolumeChart';
import { AuditActivityFeed } from '#/components/data-display/AuditActivityFeed';
import { QuickActions } from '#/components/data-display/QuickActions';
import {
  healthTrendData,
  osDistributionData,
  onboardingVolumeData,
  auditActivityData,
  dashboardStats,
  quickActionsData,
} from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DashboardHeader(): JSX.Element {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          IT Automation Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time overview of your infrastructure
        </p>
      </div>
      <Button className="shrink-0" aria-label="Run network scan to discover new assets">
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Run Network Scan
      </Button>
    </header>
  );
}

function StatsRow(): JSX.Element {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-label="Key performance indicators"
    >
      <StatsCard
        title="Total Assets"
        value={dashboardStats.totalAssets}
        subtitle="Registered devices"
        trend={{
          value: dashboardStats.totalAssetsChange,
          direction: 'up',
          label: 'this week',
        }}
        icon={Monitor}
        variant="primary"
      />
      <StatsCard
        title="Online"
        value={dashboardStats.online}
        subtitle={`${dashboardStats.onlinePercentage}% uptime`}
        icon={Wifi}
        variant="success"
      />
      <StatsCard
        title="Offline"
        value={dashboardStats.offline}
        subtitle="Currently unreachable"
        trend={{
          value: dashboardStats.offlineChange,
          direction: 'up',
          label: 'since yesterday',
        }}
        icon={WifiOff}
        variant="danger"
      />
      <StatsCard
        title="Health Alerts"
        value={dashboardStats.healthAlerts}
        subtitle={`${dashboardStats.criticalAlerts} critical`}
        icon={AlertTriangle}
        variant="warning"
      />
    </section>
  );
}

function HealthTrendSection(): JSX.Element {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Device Health Trend</CardTitle>
            <CardDescription>Average health score over last 30 days</CardDescription>
          </div>
          <div className="flex items-center gap-2" aria-label="Health status legend">
            <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/20">
              Healthy
            </Badge>
            <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">
              Warning
            </Badge>
            <Badge variant="secondary" className="bg-danger/10 text-danger hover:bg-danger/20">
              Critical
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <HealthTrendChart data={healthTrendData} />
      </CardContent>
    </Card>
  );
}

function OSDistributionSection(): JSX.Element {
  const total = useMemo(
    () => osDistributionData.reduce((sum, item) => sum + item.count, 0),
    []
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>OS Distribution</CardTitle>
        <CardDescription>Breakdown by operating system</CardDescription>
      </CardHeader>
      <CardContent>
        <OSDistributionChart data={osDistributionData} total={total} />
      </CardContent>
    </Card>
  );
}

function OnboardingVolumeSection(): JSX.Element {
  const summary = useMemo(() => {
    return onboardingVolumeData.reduce(
      (acc, week) => ({
        completed: acc.completed + week.completed,
        inProgress: acc.inProgress + week.inProgress,
        failed: acc.failed + week.failed,
      }),
      { completed: 0, inProgress: 0, failed: 0 }
    );
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onboarding Volume</CardTitle>
            <CardDescription>New employees this month</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/20">
            +18%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <OnboardingVolumeChart data={onboardingVolumeData} />
        <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-success">{summary.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-primary">{summary.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-danger">{summary.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditActivitySection(): JSX.Element {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Audit Activity</CardTitle>
            <CardDescription>Latest changes across the system</CardDescription>
          </div>
          <a href="/audit-logs" className="text-sm font-medium text-primary hover:underline h-auto p-0">
            View all
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <AuditActivityFeed items={auditActivityData} />
      </CardContent>
    </Card>
  );
}

function QuickActionsSection(): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Frequently used operations</CardDescription>
      </CardHeader>
      <CardContent>
        <QuickActions actions={quickActionsData} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Dashboard(): JSX.Element {
  return (
    <main id="main-content" className="px-6 py-8 space-y-6" tabIndex={-1}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <DashboardHeader />
      <StatsRow />

      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        aria-label="Analytics charts"
      >
        <HealthTrendSection />
        <OSDistributionSection />
      </section>

      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        aria-label="Operational overview"
      >
        <OnboardingVolumeSection />
        <AuditActivitySection />
      </section>

      <QuickActionsSection />
    </main>
  );
}
