/**
 * @fileoverview Onboarding volume stacked bar chart.
 * Displays weekly breakdown of completed, in-progress, and failed onboardings.
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
    <div className="rounded-lg border bg-card p-3 shadow-lg min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-success font-medium">Completed</span>
          <span className="tabular-nums">{raw.completed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-primary font-medium">In Progress</span>
          <span className="tabular-nums">{raw.inProgress}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-danger font-medium">Failed</span>
          <span className="tabular-nums">{raw.failed}</span>
        </div>
        <div className="border-t pt-1 mt-1 flex justify-between text-sm font-bold">
          <span>Total</span>
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
  return (
    <div className="w-full h-48" role="img" aria-label="Onboarding volume by week">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.1}
            vertical={false}
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            stackId="a"
            fill="hsl(142 76% 36%)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="inProgress"
            name="In Progress"
            stackId="a"
            fill="hsl(221 83% 53%)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="failed"
            name="Failed"
            stackId="a"
            fill="hsl(0 84% 60%)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
