/**
 * Virtualized table body using @tanstack/react-virtual
 * Mandatory for >100 rows per performance spec
 * @module components/data-display/VirtualizedTableBody
 */

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { cn } from "#/lib/utils";
import type { Asset } from "#/types/asset";

interface VirtualizedTableBodyProps {
  table: TanStackTable<Asset>;
}

const ROW_HEIGHT = 52; // Fixed row height for performance

export function VirtualizedTableBody({ table }: VirtualizedTableBodyProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} className="relative overflow-auto" style={{ height: "600px" }}>
      <div style={{ height: `${totalSize}px`, width: "100%", position: "relative" }}>
        <table className="w-full caption-bottom text-sm">
          <tbody>
            {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                    "absolute left-0 w-full"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-4 align-middle"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}