import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

/**
 * A sortable in-column section: a SortableContext over `items` whose wrapper is
 * also a droppable carrying the same `id`. The droppable lets an empty section
 * (and the gaps between rows) still resolve as an over-target, so cross-section
 * moves and overflow preview work even when a list is empty.
 *
 * Tasks 8-12 wrap their three-things / other / adhoc / pool lists in this.
 */
export function SortableSection({
  id,
  items,
  children,
}: {
  id: string;
  items: string[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} data-container={id}>
        {children}
      </div>
    </SortableContext>
  );
}
