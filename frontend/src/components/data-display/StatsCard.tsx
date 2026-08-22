/**
 * @fileoverview Premium high-signal metric card for dashboard stats.
 * Features gradient accent borders, refined icon containers, and
 * editorial typography with subtle hover lift.
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
// Variant Configuration — Premium Gradient Accents
// ---------------------------------------------------------------------------

const variantConfig = {
  primary: {
    gradient: 'from-primary/80 to-primary/20',
    iconGradient: 'from-primary/15 to-primary/5',
    iconColor: 'text-primary',
    trendUp: 'text-success',
    trendDown: 'text-danger',
    glow: 'group-hover:shadow-glow-primary',
  },
  success: {
    gradient: 'from-success/80 to-success/20',
    iconGradient: 'from-success/15 to-success/5',
    iconColor: 'text-success',
    trendUp: 'text-success',
    trendDown: 'text-danger',
    glow: 'group-hover:shadow-glow-success',
  },
  warning: {
    gradient: 'from-warning/80 to-warning/20',
    iconGradient: 'from-warning/15 to-warning/5',
    iconColor: 'text-warning',
    trendUp: 'text-success',
    trendDown: 'text-danger',
    glow: 'group-hover:shadow-glow-warning',
  },
  danger: {
    gradient: 'from-danger/80 to-danger/20',
    iconGradient: 'from-danger/15 to-danger/5',
    iconColor: 'text-danger',
    trendUp: 'text-success',
    trendDown: 'text-danger',
    glow: 'group-hover:shadow-glow-danger',
  },
  info: {
    gradient: 'from-info/80 to-info/20',
    iconGradient: 'from-info/15 to-info/5',
    iconColor: 'text-info',
    trendUp: 'text-success',
    trendDown: 'text-danger',
    glow: 'group-hover:shadow-glow-primary',
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
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/80 bg-card',
        'shadow-card dark:shadow-card-dark',
        'transition-all duration-300 ease-premium',
        'hover:shadow-card-hover dark:hover:shadow-card-dark-hover hover:-translate-y-0.5',
        config.glow
      )}
    >
      {/* Left gradient accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b',
          config.gradient
        )}
        aria-hidden="true"
      />

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0">
            {/* Title */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {title}
            </p>

            {/* Value */}
            <h3
              className={cn(
                'text-3xl font-bold tabular-nums tracking-tight leading-none',
                variant === 'danger' && 'text-danger',
                variant === 'warning' && 'text-warning',
                variant === 'success' && 'text-success',
                variant === 'primary' && 'text-foreground',
                variant === 'info' && 'text-info'
              )}
            >
              {value.toLocaleString('de-DE')}
            </h3>

            {/* Trend or Subtitle */}
            {trend ? (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  trend.direction === 'up' 
                    ? 'bg-success/8 text-success' 
                    : 'bg-danger/8 text-danger'
                )}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                )}
                {trend.value > 0 ? '+' : ''}
                {trend.value} {trend.label}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{subtitle}</p>
            )}
          </div>

          {/* Icon container with gradient background */}
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              'bg-gradient-to-br',
              config.iconGradient,
              'ring-1 ring-inset ring-foreground/5',
              'transition-transform duration-300 ease-premium',
              'group-hover:scale-105'
            )}
            aria-hidden="true"
          >
            <Icon className={cn('h-5 w-5', config.iconColor)} />
          </div>
        </div>
      </div>
    </div>
  );
}
