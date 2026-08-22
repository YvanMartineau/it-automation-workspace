/**
 * @fileoverview Operating system distribution visualization — Premium Edition.
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
    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 shadow-xl min-w-[150px]">
      <p className="text-sm font-semibold text-foreground">{raw.name}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{raw.count.toLocaleString('de-DE')}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{raw.percentage}% of total</p>
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
      {/* Donut Chart */}
      <div className="flex justify-center" role="img" aria-label="Operating system distribution donut chart">
        <div className="relative h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...data]}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
                cornerRadius={4}
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
            <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{total.toLocaleString('de-DE')}</span>
            <span className="text-[11px] text-muted-foreground font-medium mt-0.5">Devices</span>
          </div>
        </div>
      </div>

      {/* Ranked Legend */}
      <div className="space-y-3.5">
        {data.map((item, index) => (
          <div key={item.name} className="group space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2.5">
                <span 
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="font-medium text-foreground/90">{item.name}</span>
              </div>
              <span className="text-muted-foreground tabular-nums text-xs font-medium">
                {item.count.toLocaleString('de-DE')} <span className="text-muted-foreground/50">({item.percentage}%)</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-premium"
                style={{ 
                  width: `${item.percentage}%`, 
                  backgroundColor: item.color,
                  transitionDelay: `${index * 80}ms`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
