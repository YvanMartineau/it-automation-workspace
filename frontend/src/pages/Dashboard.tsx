/**
 * @fileoverview IT Automation Dashboard — Main Overview Page.
 * High-signal metrics, health trends, OS distribution, onboarding volume,
 * recent audit activity, and quick actions. Built with strict TypeScript,
 * zero any types, and full WCAG 2.1 AA accessibility.
 *
 * Live data comes from GET /dashboard via useDashboard() (see
 * hooks/useDashboard.ts and backend/services/dashboard.py).
 * quickActionsData remains mock — those are static frontend-only links,
 * not backend-derived (see quickActionsData in lib/mock-data.ts).
 */

import { useMemo } from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
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
import { quickActionsData } from '#/lib/mock-data';
import { useDashboard, type DashboardSnapshot } from '#/hooks/useDashboard';

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

interface StatsRowProps {
  readonly stats: DashboardSnapshot['stats'];
}

function StatsRow({ stats }: StatsRowProps): JSX.Element {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-label="Key performance indicators"
    >
      <StatsCard
        title="Total Assets"
        value={stats.totalAssets}
        subtitle="Registered devices"
        trend={{
          value: stats.totalAssetsChange,
          direction: 'up',
          label: 'this week',
        }}
        icon={Monitor}
        variant="primary"
      />
      <StatsCard
        title="Online"
        value={stats.online}
        subtitle={`${stats.onlinePercentage}% uptime`}
        icon={Wifi}
        variant="success"
      />
      <StatsCard
        title="Offline"
        value={stats.offline}
        subtitle="Currently unreachable"
        trend={{
          value: stats.offlineChange,
          direction: 'up',
          label: 'since yesterday',
        }}
        icon={WifiOff}
        variant="danger"
      />
      <StatsCard
        title="Health Alerts"
        value={stats.healthAlerts}
        subtitle={`${stats.criticalAlerts} critical`}
        icon={AlertTriangle}
        variant="warning"
      />
    </section>
  );
}

interface HealthTrendSectionProps {
  readonly data: DashboardSnapshot['healthTrend'];
}

function HealthTrendSection({ data }: HealthTrendSectionProps): JSX.Element {
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
        <HealthTrendChart data={data} />
      </CardContent>
    </Card>
  );
}

interface OSDistributionSectionProps {
  readonly data: DashboardSnapshot['osDistribution'];
}

function OSDistributionSection({ data }: OSDistributionSectionProps): JSX.Element {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>OS Distribution</CardTitle>
        <CardDescription>Breakdown by operating system</CardDescription>
      </CardHeader>
      <CardContent>
        <OSDistributionChart data={data} total={total} />
      </CardContent>
    </Card>
  );
}

interface OnboardingVolumeSectionProps {
  readonly data: DashboardSnapshot['onboardingVolume'];
}

function OnboardingVolumeSection({ data }: OnboardingVolumeSectionProps): JSX.Element {
  const summary = useMemo(() => {
    return data.reduce(
      (acc, week) => ({
        completed: acc.completed + week.completed,
        inProgress: acc.inProgress + week.inProgress,
        failed: acc.failed + week.failed,
      }),
      { completed: 0, inProgress: 0, failed: 0 }
    );
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Onboarding Volume</CardTitle>
        <CardDescription>New employees this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <OnboardingVolumeChart data={data} />
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

interface AuditActivitySectionProps {
  readonly items: DashboardSnapshot['auditActivity'];
}

function AuditActivitySection({ items }: AuditActivitySectionProps): JSX.Element {
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
        <AuditActivityFeed items={items} />
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
// Loading / error states
// ---------------------------------------------------------------------------

function DashboardLoading(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">Loading dashboard…</p>
    </div>
  );
}

interface DashboardErrorProps {
  readonly onRetry: () => void;
}

function DashboardError({ onRetry }: DashboardErrorProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load the dashboard. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Dashboard(): JSX.Element {
  const { data, isLoading, isError, refetch } = useDashboard();

  return (
    <main id="main-content" className="px-6 py-8 space-y-6" tabIndex={-1}>
      
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <DashboardHeader />

      {isLoading && <DashboardLoading />}
      {isError && !isLoading && <DashboardError onRetry={() => void refetch()} />}

      {data && (
        <>
          <StatsRow stats={data.stats} />

          <section
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            aria-label="Analytics charts"
          >
            <HealthTrendSection data={data.healthTrend} />
            <OSDistributionSection data={data.osDistribution} />
          </section>

          <section
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            aria-label="Operational overview"
          >
            <OnboardingVolumeSection data={data.onboardingVolume} />
            <AuditActivitySection items={data.auditActivity} />
          </section>

          <QuickActionsSection />
        </>
      )}
    </main>
  );
}