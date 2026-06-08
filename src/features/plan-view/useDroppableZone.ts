import { useDroppable } from "@dnd-kit/core";
import { dropId, type DropTarget } from "./dnd";

export function useDroppableZone(target: DropTarget) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(target) });
  return { ref: setNodeRef, isOver };
}
