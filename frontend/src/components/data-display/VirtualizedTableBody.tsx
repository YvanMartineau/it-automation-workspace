// frontend/src/components/data-display/VirtualizedTableBody.tsx
/**
 * Virtualized table body using @tanstack/react-virtual.
 * Renders inside AssetTable's shared scroll container (passed via
 * scrollContainerRef) rather than owning its own scroll box — this keeps
 * horizontal scroll synchronized with the sticky header, since both live
 * in the same native scroll context.
 * @module components/data-display/VirtualizedTableBody
 */

import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import type { Asset } from "#/types/asset";

interface VirtualizedTableBodyProps {
  table: TanStackTable<Asset>;
  gridTemplateColumns: string;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

const ROW_HEIGHT = 52; // Fixed row height for performance

export function VirtualizedTableBody({
  table,
  gridTemplateColumns,
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
    <div style={{ height: `${totalSize}px`, width: "100%", position: "relative" }}>
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={row.id}
            data-index={virtualRow.index}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className="absolute left-0 grid w-full items-center border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
            style={{
              gridTemplateColumns,
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} className="flex items-center p-4 align-middle">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}