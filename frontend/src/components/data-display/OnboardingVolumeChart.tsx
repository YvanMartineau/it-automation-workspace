/**
 * @fileoverview Onboarding volume stacked bar chart — Premium Edition.
 * Displays weekly breakdown with refined colors and glassmorphism tooltip.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '#/lib/utils';
import type { OnboardingVolumeDataPoint } from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

function isOnboardingVolumeDataPoint(value: unknown): value is OnboardingVolumeDataPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'week' in value &&
    'completed' in value &&
    'inProgress' in value &&
    'failed' in value &&
    typeof (value as Record<string, unknown>).week === 'string' &&
    typeof (value as Record<string, unknown>).completed === 'number' &&
    typeof (value as Record<string, unknown>).inProgress === 'number' &&
    typeof (value as Record<string, unknown>).failed === 'number'
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipPayloadItem {
  readonly dataKey: string;
  readonly value: number;
  readonly payload: OnboardingVolumeDataPoint;
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly CustomTooltipPayloadItem[];
  readonly label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const raw = payload[0]?.payload;
  if (!isOnboardingVolumeDataPoint(raw)) {
    return null;
  }

  const total = raw.completed + raw.inProgress + raw.failed;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-4 shadow-xl min-w-[180px]">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">Completed</span>
          </div>
          <span className="tabular-nums font-semibold text-foreground">{raw.completed}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <span className="tabular-nums font-semibold text-foreground">{raw.inProgress}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-danger" />
            <span className="text-muted-foreground">Failed</span>
          </div>
          <span className="tabular-nums font-semibold text-foreground">{raw.failed}</span>
        </div>
        <div className="border-t border-border/60 pt-2 mt-2 flex justify-between text-sm font-bold">
          <span className="text-foreground">Total</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingVolumeChartProps {
  readonly data: readonly OnboardingVolumeDataPoint[];
}

export function OnboardingVolumeChart({ data }: OnboardingVolumeChartProps): JSX.Element {
  const summary = data.reduce(
    (acc, week) => ({
      completed: acc.completed + week.completed,
      inProgress: acc.inProgress + week.inProgress,
      failed: acc.failed + week.failed,
    }),
    { completed: 0, inProgress: 0, failed: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="w-full h-48" role="img" aria-label="Onboarding volume by week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...data]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              strokeOpacity={0.06}
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground/60"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              className="text-muted-foreground/60"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.04 }} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '16px', fontWeight: 500 }}
              iconType="circle"
              iconSize={7}
            />
            <Bar
              dataKey="completed"
              name="Completed"
              stackId="a"
              fill="hsl(150 60% 42%)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="inProgress"
              name="In Progress"
              stackId="a"
              fill="hsl(224 76% 48%)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failed"
              name="Failed"
              stackId="a"
              fill="hsl(0 72% 55%)"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-5">
        <SummaryPill 
          icon={CheckCircle2} 
          value={summary.completed} 
          label="Completed" 
          color="success" 
        />
        <SummaryPill 
          icon={Loader2} 
          value={summary.inProgress} 
          label="In Progress" 
          color="primary" 
        />
        <SummaryPill 
          icon={XCircle} 
          value={summary.failed} 
          label="Failed" 
          color="danger" 
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Pill Sub-component
// ---------------------------------------------------------------------------

interface SummaryPillProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly value: number;
  readonly label: string;
  readonly color: 'success' | 'primary' | 'danger';
}

function SummaryPill({ icon: Icon, value, label, color }: SummaryPillProps): JSX.Element {
  const colorMap = {
    success: {
      bg: 'bg-success/8',
      text: 'text-success',
      iconBg: 'bg-success/12',
    },
    primary: {
      bg: 'bg-primary/8',
      text: 'text-primary',
      iconBg: 'bg-primary/12',
    },
    danger: {
      bg: 'bg-danger/8',
      text: 'text-danger',
      iconBg: 'bg-danger/12',
    },
  };

  const c = colorMap[color];

  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl p-3', c.bg)}>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.iconBg)}>
        <Icon className={cn('h-4 w-4', c.text)} />
      </div>
      <p className={cn('text-xl font-bold tabular-nums tracking-tight', c.text)}>{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
