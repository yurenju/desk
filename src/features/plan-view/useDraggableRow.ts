import { useDraggable } from "@dnd-kit/core";
import { useDragEnabled } from "./dragContext";

export function useDraggableRow(id: string) {
  const enabled = useDragEnabled();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !enabled });
  return {
    ref: setNodeRef,
    handleProps: enabled ? { ...attributes, ...listeners } : {},
    isDragging,
  };
}
