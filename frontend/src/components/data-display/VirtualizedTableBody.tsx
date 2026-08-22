// frontend/src/components/data-display/VirtualizedTableBody.tsx
/**
 * Virtualized table body — Premium Edition.
 * Renders inside AssetTable's shared scroll container.
 * NO row animations — performance critical.
 */

import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { cn } from "#/lib/utils";
import type { Asset } from "#/types/asset";

interface VirtualizedTableBodyProps {
  table: TanStackTable<Asset>;
  gridTemplateColumns: string;
  tableMinWidth: number;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

const ROW_HEIGHT = 52;

export function VirtualizedTableBody({
  table,
  gridTemplateColumns,
  tableMinWidth,
  scrollContainerRef,
}: VirtualizedTableBodyProps) {
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div style={{ height: `${totalSize}px`, width: "100%", minWidth: `${tableMinWidth}px`, position: "relative" }}>
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={row.id}
            data-index={virtualRow.index}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn(
              "absolute left-0 grid items-center border-b border-border/40",
              /* NO transition — performance critical */
              "hover:bg-accent/25",
              "data-[state=selected]:bg-primary/[0.04]"
            )}
            style={{
              gridTemplateColumns,
              width: "100%",
              minWidth: `${tableMinWidth}px`,
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} className="flex items-center px-4 py-3 align-middle">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
