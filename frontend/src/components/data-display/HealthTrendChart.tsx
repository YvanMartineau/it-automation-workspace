/**
 * @fileoverview 30-day device health trend visualization.
 * Uses Recharts AreaChart with gradient fill and strict type guards.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '#/lib/utils';
import type { HealthTrendDataPoint, HealthStatus } from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

function isHealthTrendDataPoint(value: unknown): value is HealthTrendDataPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'date' in value &&
    'score' in value &&
    'status' in value &&
    typeof (value as Record<string, unknown>).date === 'string' &&
    typeof (value as Record<string, unknown>).score === 'number' &&
    typeof (value as Record<string, unknown>).status === 'string'
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipPayloadItem {
  readonly payload: HealthTrendDataPoint;
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
  if (!isHealthTrendDataPoint(raw)) {
    return null;
  }

  const statusColorMap: Record<HealthStatus, string> = {
    healthy: 'text-success',
    warning: 'text-warning',
    critical: 'text-danger',
  };

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums">{raw.score}%</p>
      <p className={cn('text-xs font-medium capitalize', statusColorMap[raw.status])}>
        {raw.status}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HealthTrendChartProps {
  readonly data: readonly HealthTrendDataPoint[];
}

export function HealthTrendChart({ data }: HealthTrendChartProps): JSX.Element {
  return (
    <div className="w-full h-72" role="img" aria-label="Device health trend over last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={[...data]}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.1}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={30}
            className="text-muted-foreground"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `${value}%`}
            className="text-muted-foreground"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'hsl(221 83% 53%)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(221 83% 53%)"
            strokeWidth={2}
            fill="url(#healthGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: 'hsl(221 83% 53%)',
              stroke: 'hsl(var(--card))',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
