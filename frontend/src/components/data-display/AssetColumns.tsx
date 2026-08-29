// frontend/src/components/data-display/AssetColumns.tsx
/**
 * Reusable badge components for asset health and status.
 * @module components/data-display/AssetColumns
 */

import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import type { AssetHealth, DeviceStatus } from "#/types/asset";

// ---------------------------------------------------------------------------
// Premium Health Badge
// ---------------------------------------------------------------------------

const HEALTH_STYLES: Record<AssetHealth, string> = {
  healthy: "bg-success/8 text-success border-success/20",
  warning: "bg-warning/8 text-warning border-warning/20",
  critical: "bg-danger/8 text-danger border-danger/20",
  unknown: "bg-muted/60 text-muted-foreground border-muted",
};

const HEALTH_LABELS: Record<AssetHealth, string> = {
  healthy: "Gesund",
  warning: "Langsam",
  critical: "Kritisch",
  unknown: "Unbekannt",
};

export function HealthBadge({ health }: { health: AssetHealth }): JSX.Element {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        HEALTH_STYLES[health]
      )}
    >
      {HEALTH_LABELS[health]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Premium Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: "bg-success/8 text-success border-success/20",
  offline: "bg-danger/8 text-danger border-danger/20",
  unknown: "bg-muted/60 text-muted-foreground border-muted",
};

const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Unbekannt",
};

export function StatusBadge({ status }: { status: DeviceStatus }): JSX.Element {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
