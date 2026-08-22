/**
 * @fileoverview Recent audit activity feed — Premium Edition.
 * Timeline-style feed with refined icons, hover states, and
 * editorial typography.
 */

import { useMemo } from 'react';
import {
  Pencil,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  FileDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '#/lib/utils';
import type { AuditActivityItem, AuditActivityType } from '#/lib/mock-data';

// ---------------------------------------------------------------------------
// Type Configuration — Premium Gradient Icon Backgrounds
// ---------------------------------------------------------------------------

interface ActivityTypeConfig {
  readonly icon: LucideIcon;
  readonly gradient: string;
  readonly iconColor: string;
  readonly ring: string;
}

const activityTypeConfig: Record<AuditActivityType, ActivityTypeConfig> = {
  update: {
    icon: Pencil,
    gradient: 'from-primary/12 to-primary/4',
    iconColor: 'text-primary',
    ring: 'ring-primary/15',
  },
  create: {
    icon: ShieldCheck,
    gradient: 'from-success/12 to-success/4',
    iconColor: 'text-success',
    ring: 'ring-success/15',
  },
  delete: {
    icon: Trash2,
    gradient: 'from-danger/12 to-danger/4',
    iconColor: 'text-danger',
    ring: 'ring-danger/15',
  },
  alert: {
    icon: AlertTriangle,
    gradient: 'from-warning/12 to-warning/4',
    iconColor: 'text-warning',
    ring: 'ring-warning/15',
  },
  report: {
    icon: FileDown,
    gradient: 'from-info/12 to-info/4',
    iconColor: 'text-info',
    ring: 'ring-info/15',
  },
};

// ---------------------------------------------------------------------------
// Time Formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AuditActivityFeedProps {
  readonly items: readonly AuditActivityItem[];
}

export function AuditActivityFeed({ items }: AuditActivityFeedProps): JSX.Element {
  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [items]);

  return (
    <ul className="space-y-0.5" role="list" aria-label="Recent audit activity">
      {sortedItems.map((item, index) => {
        const config = activityTypeConfig[item.type];
        const Icon = config.icon;
        const isLast = index === sortedItems.length - 1;

        return (
          <li
            key={item.id}
            className={cn(
              'group relative flex items-start gap-3.5 rounded-xl p-3',
              'transition-all duration-200 ease-premium',
              'hover:bg-accent/40'
            )}
          >
            {/* Timeline connector */}
            {!isLast && (
              <div 
                className="absolute left-[26px] top-10 bottom-[-4px] w-px bg-border/40"
                aria-hidden="true"
              />
            )}

            {/* Icon container with gradient */}
            <div
              className={cn(
                'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                'bg-gradient-to-br',
                config.gradient,
                'ring-1',
                config.ring,
                'transition-transform duration-200 ease-premium',
                'group-hover:scale-105'
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-4 w-4', config.iconColor)} />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm leading-snug text-foreground/90">
                {item.type === 'update' && (
                  <>
                    Asset{' '}
                    <span className="font-semibold text-primary">{item.target}</span>
                    {' '}updated by{' '}
                    <span className="font-semibold text-foreground">{item.actor}</span>
                  </>
                )}
                {item.type === 'create' && (
                  <>
                    Onboarding completed for{' '}
                    <span className="font-semibold text-foreground">{item.target}</span>
                  </>
                )}
                {item.type === 'delete' && (
                  <>
                    Asset{' '}
                    <span className="font-semibold text-primary">{item.target}</span>
                    {' '}deleted by{' '}
                    <span className="font-semibold text-foreground">{item.actor}</span>
                  </>
                )}
                {item.type === 'alert' && (
                  <>
                    Health alert on{' '}
                    <span className="font-semibold text-primary">{item.target}</span>
                  </>
                )}
                {item.type === 'report' && (
                  <>
                    Report{' '}
                    <span className="font-semibold text-foreground">{item.target}</span>
                    {' '}generated
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate leading-relaxed">{item.description}</p>
            </div>

            <time
              dateTime={item.timestamp}
              className="text-[11px] font-medium text-muted-foreground/50 tabular-nums shrink-0 pt-1"
              title={new Date(item.timestamp).toLocaleString('de-DE')}
            >
              {formatRelativeTime(item.timestamp)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

