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
  tableMinWidth: number;
  scrollContainerRef: RefObject<HTMLDivElement>;
}

const ROW_HEIGHT = 52; // Fixed row height for performance

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
            className="absolute left-0 grid items-center border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
            style={{
              gridTemplateColumns,
              // BUG FIX (columns not reclaiming space when fewer are shown):
              // `position: absolute` with only `left: 0` set (no `right`)
              // sizes an element by shrink-to-fit, not by filling its
              // containing block — unlike the sticky header or the
              // non-virtualized row path, both of which stay in normal flow
              // and fill available width automatically. That's why hiding
              // columns shrank these rows toward their content minimum
              // instead of letting the remaining columns grow to fill the
              // table, while the header (not absolutely positioned) did
              // grow — causing the mismatch. `width: "100%"` paired with
              // `minWidth` restores the same "fill space, but never shrink
              // below the sum of column minimums" behavior everywhere:
              // when there's room, the row is exactly 100% of the
              // container and the `1fr` columns expand into it; when the
              // visible columns' combined minimum exceeds the container,
              // minWidth wins and the scroll container's existing
              // `overflow-auto` kicks in — so overflow only appears when
              // it's actually needed.
              width: "100%",
              minWidth: `${tableMinWidth}px`,
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