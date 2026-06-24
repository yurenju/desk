import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragEnabled } from "./dragContext";

export function useSortableRow(id: string) {
  const enabled = useDragEnabled();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });
  return {
    ref: setNodeRef,
    style: enabled ? { transform: CSS.Translate.toString(transform), transition } : undefined,
    handleProps: enabled ? { ...attributes, ...listeners } : {},
    isDragging,
  };
}
