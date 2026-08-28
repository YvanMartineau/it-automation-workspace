/**
 * @fileoverview Quick action grid — Premium Edition.
 * Refined hover states, gradient icon containers, and subtle lift.
 */

import { Monitor, UserPlus, FileText, Bell, type LucideIcon } from 'lucide-react';
import { cn } from '#/lib/utils';
import type { QuickActionItem } from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Icon Registry
// ---------------------------------------------------------------------------

const iconRegistry: Record<string, LucideIcon> = {
  Monitor,
  UserPlus,
  FileText,
  Bell,
};

// ---------------------------------------------------------------------------
// Variant Configuration
// ---------------------------------------------------------------------------

const variantConfig = {
  primary: {
    gradient: 'from-primary/12 to-primary/4',
    iconColor: 'text-primary',
    ring: 'ring-primary/15',
    hoverBorder: 'group-hover:border-primary/30',
    hoverGlow: 'group-hover:shadow-glow-primary',
  },
  success: {
    gradient: 'from-success/12 to-success/4',
    iconColor: 'text-success',
    ring: 'ring-success/15',
    hoverBorder: 'group-hover:border-success/30',
    hoverGlow: 'group-hover:shadow-glow-success',
  },
  warning: {
    gradient: 'from-warning/12 to-warning/4',
    iconColor: 'text-warning',
    ring: 'ring-warning/15',
    hoverBorder: 'group-hover:border-warning/30',
    hoverGlow: 'group-hover:shadow-glow-warning',
  },
  info: {
    gradient: 'from-info/12 to-info/4',
    iconColor: 'text-info',
    ring: 'ring-info/15',
    hoverBorder: 'group-hover:border-info/30',
    hoverGlow: 'group-hover:shadow-glow-primary',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QuickActionsProps {
  readonly actions: readonly QuickActionItem[];
}

export function QuickActions({ actions }: QuickActionsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => {
        const Icon = iconRegistry[action.iconName];
        const config = variantConfig[action.variant];

        if (!Icon) {
          console.warn(`Icon "${action.iconName}" not found in registry`);
          return null;
        }

        return (
          <a
            key={action.id}
            href={action.href}
            className={cn(
              'group relative flex items-center gap-3.5 rounded-xl border border-border/80 bg-card p-4',
              'shadow-card dark:shadow-card-dark',
              'transition-all duration-300 ease-premium',
              'hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:shadow-card-dark-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              config.hoverBorder,
              config.hoverGlow
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                'bg-gradient-to-br',
                config.gradient,
                'ring-1',
                config.ring,
                'transition-transform duration-300 ease-premium',
                'group-hover:scale-105'
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground/90 shrink-0 break-words">{action.label}</p>
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{action.description}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}