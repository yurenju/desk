// Minimal stub — Task 10 wires this to @dnd-kit. Returns no-op props so rows
// render in jsdom without a DndContext.
export function useDraggableRow(_id: string) {
  return { ref: undefined as ((el: HTMLElement | null) => void) | undefined, handleProps: {}, isDragging: false };
}
