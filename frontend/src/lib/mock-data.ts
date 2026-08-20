/**
 * @fileoverview Mock data for the IT Automation Dashboard.
 * Replace these with TanStack Query hooks once the backend is ready.
 * All types mirror the expected API contract for seamless migration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface HealthTrendDataPoint {
  readonly date: string;
  readonly score: number;
  readonly status: HealthStatus;
}

export interface OSDistributionItem {
  readonly name: string;
  readonly count: number;
  readonly percentage: number;
  readonly color: string;
}

export interface OnboardingVolumeDataPoint {
  readonly week: string;
  readonly completed: number;
  readonly inProgress: number;
  readonly failed: number;
}

export type AuditActivityType = 'update' | 'create' | 'delete' | 'alert' | 'report';

export interface AuditActivityItem {
  readonly id: string;
  readonly type: AuditActivityType;
  readonly actor: string;
  readonly target: string;
  readonly targetLabel: string;
  readonly description: string;
  readonly timestamp: string;
}

export interface DashboardStats {
  readonly totalAssets: number;
  readonly totalAssetsChange: number;
  readonly online: number;
  readonly onlinePercentage: number;
  readonly offline: number;
  readonly offlineChange: number;
  readonly healthAlerts: number;
  readonly criticalAlerts: number;
}

export interface QuickActionItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly iconName: string;
  readonly variant: 'primary' | 'success' | 'warning' | 'info';
  readonly href: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateHealthTrendData(): readonly HealthTrendDataPoint[] {
  const data: HealthTrendDataPoint[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });

    // Simulate realistic health fluctuations
    let score: number;
    if (i === 3 || i === 7 || i === 15) {
      score = Math.floor(Math.random() * 15) + 55; // critical: 55-69
    } else if (i === 1 || i === 5 || i === 12 || i === 20) {
      score = Math.floor(Math.random() * 14) + 70; // warning: 70-83
    } else {
      score = Math.floor(Math.random() * 20) + 80; // healthy: 80-99
    }

    const status: HealthStatus =
      score >= 85 ? 'healthy' : score >= 70 ? 'warning' : 'critical';

    data.push({ date: dateStr, score, status });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Data Exports
// ---------------------------------------------------------------------------

export const healthTrendData: readonly HealthTrendDataPoint[] = generateHealthTrendData();

export const osDistributionData: readonly OSDistributionItem[] = [
  { name: 'Windows 11', count: 642, percentage: 51.5, color: 'hsl(221 83% 53%)' },
  { name: 'Windows 10', count: 312, percentage: 25.0, color: 'hsl(199 89% 48%)' },
  { name: 'macOS', count: 187, percentage: 15.0, color: 'hsl(142 76% 36%)' },
  { name: 'Linux', count: 81, percentage: 6.5, color: 'hsl(38 92% 50%)' },
  { name: 'Other', count: 25, percentage: 2.0, color: 'hsl(215 16% 47%)' },
] as const;

export const onboardingVolumeData: readonly OnboardingVolumeDataPoint[] = [
  { week: 'Week 1', completed: 8, inProgress: 3, failed: 1 },
  { week: 'Week 2', completed: 12, inProgress: 2, failed: 0 },
  { week: 'Week 3', completed: 6, inProgress: 5, failed: 2 },
  { week: 'Week 4', completed: 15, inProgress: 1, failed: 0 },
] as const;

export const auditActivityData: readonly AuditActivityItem[] = [
  {
    id: 'audit-001',
    type: 'update',
    actor: 'm.schmidt',
    target: 'WS-DE-0421',
    targetLabel: 'Asset WS-DE-0421',
    description: 'Changed OS from Windows 10 to Windows 11 • Health score adjusted',
    timestamp: '2024-08-20T11:05:00Z',
  },
  {
    id: 'audit-002',
    type: 'create',
    actor: 'system',
    target: 'L. Weber',
    targetLabel: 'L. Weber',
    description: 'All 5 steps passed • Engineering department',
    timestamp: '2024-08-20T10:52:00Z',
  },
  {
    id: 'audit-003',
    type: 'delete',
    actor: 'admin',
    target: 'SRV-FR-0098',
    targetLabel: 'Asset SRV-FR-0098',
    description: 'Decommissioned server • Paris datacenter',
    timestamp: '2024-08-20T09:15:00Z',
  },
  {
    id: 'audit-004',
    type: 'alert',
    actor: 'system',
    target: 'WS-IT-0156',
    targetLabel: 'Asset WS-IT-0156',
    description: 'Disk usage exceeded 90% • Critical threshold',
    timestamp: '2024-08-20T08:30:00Z',
  },
  {
    id: 'audit-005',
    type: 'report',
    actor: 'k.mueller',
    target: 'Q3-Asset-Inventory',
    targetLabel: 'Report Q3-Asset-Inventory',
    description: 'PDF format • 1,247 assets included',
    timestamp: '2024-08-20T07:45:00Z',
  },
] as const;

export const dashboardStats: DashboardStats = {
  totalAssets: 1247,
  totalAssetsChange: 12,
  online: 1089,
  onlinePercentage: 87.3,
  offline: 98,
  offlineChange: 5,
  healthAlerts: 23,
  criticalAlerts: 3,
} as const;

export const quickActionsData: readonly QuickActionItem[] = [
  {
    id: 'qa-1',
    label: 'Add Asset',
    description: 'Register new device',
    iconName: 'Monitor',
    variant: 'primary',
    href: '/assets/new',
  },
  {
    id: 'qa-2',
    label: 'New Onboarding',
    description: 'Start employee workflow',
    iconName: 'UserPlus',
    variant: 'success',
    href: '/onboarding/new',
  },
  {
    id: 'qa-3',
    label: 'Generate Report',
    description: 'Create custom export',
    iconName: 'FileText',
    variant: 'warning',
    href: '/reports/new',
  },
  {
    id: 'qa-4',
    label: 'View Alerts',
    description: '23 open issues',
    iconName: 'Bell',
    variant: 'info',
    href: '/alerts',
  },
] as const;
