/**
 * @fileoverview Recent audit activity feed with contextual icons and metadata.
 * Displays the latest system changes with actor attribution and timestamps.
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
// Type Configuration
// ---------------------------------------------------------------------------

interface ActivityTypeConfig {
  readonly icon: LucideIcon;
  readonly iconBg: string;
  readonly iconColor: string;
}

const activityTypeConfig: Record<AuditActivityType, ActivityTypeConfig> = {
  update: {
    icon: Pencil,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  create: {
    icon: ShieldCheck,
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  delete: {
    icon: Trash2,
    iconBg: 'bg-danger/10',
    iconColor: 'text-danger',
  },
  alert: {
    icon: AlertTriangle,
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  report: {
    icon: FileDown,
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
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
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
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
    <ul className="space-y-1" role="list" aria-label="Recent audit activity">
      {sortedItems.map((item) => {
        const config = activityTypeConfig[item.type];
        const Icon = config.icon;

        return (
          <li
            key={item.id}
            className="flex items-center gap-4 p-3 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                config.iconBg
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-4 w-4', config.iconColor)} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {item.type === 'update' && (
                  <>
                    Asset{' '}
                    <span className="text-primary font-semibold">{item.target}</span>
                    {' '}updated by{' '}
                    <span className="font-semibold">{item.actor}</span>
                  </>
                )}
                {item.type === 'create' && (
                  <>
                    Onboarding completed for{' '}
                    <span className="font-semibold">{item.target}</span>
                  </>
                )}
                {item.type === 'delete' && (
                  <>
                    Asset{' '}
                    <span className="text-primary font-semibold">{item.target}</span>
                    {' '}deleted by{' '}
                    <span className="font-semibold">{item.actor}</span>
                  </>
                )}
                {item.type === 'alert' && (
                  <>
                    Health alert on{' '}
                    <span className="text-primary font-semibold">{item.target}</span>
                  </>
                )}
                {item.type === 'report' && (
                  <>
                    Report{' '}
                    <span className="font-semibold">{item.target}</span>
                    {' '}generated
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            </div>

            <time
              dateTime={item.timestamp}
              className="text-xs text-muted-foreground tabular-nums shrink-0"
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
