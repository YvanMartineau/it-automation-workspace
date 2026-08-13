//frontend/src/components/data-display/AssetEmptyState.tsx
/**
 * Empty state for Asset table when no results found
 * @module components/data-display/AssetEmptyState
 */

import { ServerOff, RefreshCw } from "lucide-react";
import { Button } from "#/components/ui/button";

interface AssetEmptyStateProps {
  onReset: () => void;
}

export function AssetEmptyState({ onReset }: AssetEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <ServerOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Keine Assets gefunden</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Keine Assets entsprechen Ihren Filterkriterien. Passen Sie die Suche an oder führen Sie einen Netzwerkscan durch.
      </p>
      <Button onClick={onReset} className="mt-6 gap-2">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Filter zurücksetzen
      </Button>
    </div>
  );
}