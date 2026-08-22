// frontend/src/components/data-display/AssetRowActions.tsx
import { useState } from "react";
import { MoreHorizontal, Eye, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { toast } from "sonner";
import type { Asset } from "#/types/asset";

interface AssetRowActionsProps {
  asset: Asset;
  onDelete: (id: string) => void;
}

export function AssetRowActions({ asset, onDelete }: AssetRowActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const displayName = asset.hostname ?? asset.ip_address;

  const handleDelete = () => {
    onDelete(asset.id);
    setShowDeleteDialog(false);
    toast.success("Asset gelöscht", {
      description: `${displayName} wurde erfolgreich entfernt.`,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent/80 transition-colors"
              aria-label="Aktionen öffnen"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl">
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 rounded-lg text-xs">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 rounded-lg text-xs">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteDialog(true);
            }}
            className="gap-2 rounded-lg text-xs text-danger focus:text-danger focus:bg-danger/5"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader className="gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15">
              <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Asset löschen</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground/80 leading-relaxed mt-1.5">
                Sind Sie sicher, dass Sie <strong className="text-foreground">{displayName}</strong> löschen möchten?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              className="rounded-xl"
            >
              Abbrechen
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="rounded-xl gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}