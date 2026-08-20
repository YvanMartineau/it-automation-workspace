/**
 * @fileoverview Quick action grid for common dashboard tasks.
 * Provides one-tap access to high-frequency operations.
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
    hoverBorder: 'hover:border-primary',
    hoverBg: 'hover:bg-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  success: {
    hoverBorder: 'hover:border-success',
    hoverBg: 'hover:bg-success/5',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  warning: {
    hoverBorder: 'hover:border-warning',
    hoverBg: 'hover:bg-warning/5',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  info: {
    hoverBorder: 'hover:border-info',
    hoverBg: 'hover:bg-info/5',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
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
              'flex items-center gap-3 p-4 rounded-lg border bg-card',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              config.hoverBorder,
              config.hoverBg
            )}
          >
            <div
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                config.iconBg
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-muted-foreground truncate">{action.description}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
