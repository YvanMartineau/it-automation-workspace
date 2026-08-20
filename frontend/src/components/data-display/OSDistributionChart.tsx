/**
 * @fileoverview Operating system distribution visualization.
 * Combines a Recharts PieChart with a ranked horizontal bar legend.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { OSDistributionItem } from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

function isOSDistributionItem(value: unknown): value is OSDistributionItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'count' in value &&
    'percentage' in value &&
    'color' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof (value as Record<string, unknown>).count === 'number' &&
    typeof (value as Record<string, unknown>).percentage === 'number' &&
    typeof (value as Record<string, unknown>).color === 'string'
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipPayloadItem {
  readonly payload: OSDistributionItem;
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly CustomTooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const raw = payload[0]?.payload;
  if (!isOSDistributionItem(raw)) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg min-w-[140px]">
      <p className="text-sm font-medium">{raw.name}</p>
      <p className="text-lg font-bold tabular-nums">{raw.count.toLocaleString('de-DE')}</p>
      <p className="text-xs text-muted-foreground">{raw.percentage}% of total</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OSDistributionChartProps {
  readonly data: readonly OSDistributionItem[];
  readonly total: number;
}

export function OSDistributionChart({ data, total }: OSDistributionChartProps): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      <div className="flex justify-center" role="img" aria-label="Operating system distribution donut chart">
        <div className="relative h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...data]}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="count"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold tabular-nums">{total.toLocaleString('de-DE')}</span>
            <span className="text-xs text-muted-foreground">Devices</span>
          </div>
        </div>
      </div>

      {/* Ranked Legend */}
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.count.toLocaleString('de-DE')} ({item.percentage}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
