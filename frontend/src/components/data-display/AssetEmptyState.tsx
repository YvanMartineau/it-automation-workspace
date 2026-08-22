// frontend/src/components/data-display/AssetEmptyState.tsx
/**
 * Empty state — Premium Edition
 * @module components/data-display/AssetEmptyState
 */

import { ServerOff, RefreshCw } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

interface AssetEmptyStateProps {
  onReset: () => void;
}

export function AssetEmptyState({ onReset }: AssetEmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl",
          "bg-gradient-to-br from-muted/80 to-muted/30",
          "ring-1 ring-border/60"
        )}
        aria-hidden="true"
      >
        <ServerOff className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-foreground/90">Keine Assets gefunden</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground/70 leading-relaxed">
        Keine Assets entsprechen Ihren Filterkriterien. Passen Sie die Suche an oder führen Sie einen Netzwerkscan durch.
      </p>
      <Button 
        onClick={onReset} 
        className="mt-6 gap-2 rounded-xl"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Filter zurücksetzen
      </Button>
    </div>
  );
}
