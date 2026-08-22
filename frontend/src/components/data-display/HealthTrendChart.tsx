/**
 * @fileoverview 30-day device health trend visualization — Premium Edition.
 * Uses Recharts AreaChart with multi-stop gradient fill and
 * refined glassmorphism tooltip.
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
// Custom Tooltip — Glassmorphism
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

  const statusBgMap: Record<HealthStatus, string> = {
    healthy: 'bg-success/10',
    warning: 'bg-warning/10',
    critical: 'bg-danger/10',
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 shadow-xl min-w-[170px]">
      <p className="text-[11px] font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold tabular-nums tracking-tight">{raw.score}%</p>
        <span className={cn('text-[11px] font-semibold capitalize px-1.5 py-0.5 rounded-full', statusBgMap[raw.status], statusColorMap[raw.status])}>
          {raw.status}
        </span>
      </div>
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
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            {/* Multi-stop gradient for health visualization */}
            <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(224 76% 48%)" stopOpacity={0.22} />
              <stop offset="50%" stopColor="hsl(224 76% 48%)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="hsl(224 76% 48%)" stopOpacity={0} />
            </linearGradient>
            {/* Stroke gradient */}
            <linearGradient id="healthStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(224 76% 48%)" />
              <stop offset="100%" stopColor="hsl(250 80% 60%)" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.06}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={30}
            className="text-muted-foreground/60"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `${value}%`}
            className="text-muted-foreground/60"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ 
              stroke: 'hsl(var(--primary))', 
              strokeWidth: 1, 
              strokeDasharray: '4 4',
              strokeOpacity: 0.4 
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="url(#healthStroke)"
            strokeWidth={2.5}
            fill="url(#healthGradient)"
            dot={false}
            activeDot={{
              r: 6,
              fill: 'hsl(var(--card))',
              stroke: 'hsl(224 76% 48%)',
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
