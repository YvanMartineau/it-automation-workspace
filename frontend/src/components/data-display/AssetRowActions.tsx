//frontend/src/components/data-display/AssetRowActions.tsx
import { useState } from "react";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
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

  // hostname is nullable on Device (nmap doesn't always resolve one) —
  // fall back to ip_address so this never renders "undefined" or an
  // empty string in the toast/confirmation copy.
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
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Aktionen öffnen" />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteDialog(true);
            }}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asset löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie <strong>{displayName}</strong> löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}