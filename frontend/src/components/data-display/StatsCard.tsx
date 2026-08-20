/**
 * @fileoverview High-signal metric card for dashboard stats.
 * Displays a primary value, contextual subtitle, and optional trend indicator.
 */

import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '#/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendIndicator {
  readonly value: number;
  readonly direction: 'up' | 'down';
  readonly label: string;
}

interface StatsCardProps {
  readonly title: string;
  readonly value: number;
  readonly subtitle: string;
  readonly trend?: TrendIndicator;
  readonly icon: LucideIcon;
  readonly variant: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

// ---------------------------------------------------------------------------
// Variant Configuration
// ---------------------------------------------------------------------------

const variantConfig = {
  primary: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    trendUp: 'text-success',
    trendDown: 'text-danger',
  },
  success: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    trendUp: 'text-success',
    trendDown: 'text-danger',
  },
  warning: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    trendUp: 'text-success',
    trendDown: 'text-danger',
  },
  danger: {
    iconBg: 'bg-danger/10',
    iconColor: 'text-danger',
    trendUp: 'text-success',
    trendDown: 'text-danger',
  },
  info: {
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    trendUp: 'text-success',
    trendDown: 'text-danger',
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatsCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  variant,
}: StatsCardProps): JSX.Element {
  const config = variantConfig[variant];

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3
            className={cn(
              'text-3xl font-bold tabular-nums tracking-tight',
              variant === 'danger' && 'text-danger',
              variant === 'warning' && 'text-warning',
              variant === 'success' && 'text-success'
            )}
          >
            {value.toLocaleString('de-DE')}
          </h3>

          {trend ? (
            <p
              className={cn(
                'text-xs flex items-center gap-1 font-medium',
                trend.direction === 'up' ? config.trendUp : config.trendDown
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {trend.value > 0 ? '+' : ''}
              {trend.value} {trend.label}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div
          className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center shrink-0',
            config.iconBg
          )}
          aria-hidden="true"
        >
          <Icon className={cn('h-6 w-6', config.iconColor)} />
        </div>
      </div>

      {!trend && subtitle && (
        <p className="text-xs text-muted-foreground mt-3">{subtitle}</p>
      )}
    </div>
  );
}
