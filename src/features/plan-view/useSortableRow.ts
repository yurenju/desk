import type { PointerEvent as ReactPointerEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragEnabled } from "./dragContext";

// Interactive leaf controls nested in a draggable row (the priority ring, the ⋯
// menu trigger, the checkbox, inline-edit input, detail trigger) own their own
// pointer gestures. The row spreads dnd-kit's pointer listeners over its whole
// box, so a pointerdown on one of these would otherwise start a drag and swallow
// the control's own open/click. Skip drag activation when the gesture starts on
// such a control so menus/checkboxes keep working inside a sortable row.
//
// NOTE: anchors (`<a>`) are intentionally excluded — the Week column nests its
// sortable top-3 items INSIDE the day-navigation `<Link>`, so matching `a` here
// would wrongly disable week-cell dragging. Only true leaf controls are matched.
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, input, textarea, select"));
}

export function useSortableRow(id: string) {
  const enabled = useDragEnabled();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });

  // Wrap dnd-kit's onPointerDown so a gesture beginning on an interactive control
  // never starts a drag (the control handles it instead).
  const guardedListeners = listeners
    ? {
        ...listeners,
        onPointerDown: (e: ReactPointerEvent) => {
          if (isInteractiveTarget(e.target)) return;
          listeners.onPointerDown?.(e);
        },
      }
    : listeners;

  // dnd-kit's `attributes` make the row itself `role="button"` + focusable (for its
  // KeyboardSensor a11y story). But our rows have NO keyboard drag (no
  // KeyboardSensor, per spec) AND wrap their own interactive controls (ring, ⋯
  // menu, checkbox). A row announced as a button nests those controls inside a
  // button, which breaks click/menu-open on the inner controls (and is invalid
  // a11y). Drop the button role/tabindex; keep only the pointer drag.
  const { role, tabIndex, ...safeAttributes } = attributes;
  void role;
  void tabIndex;

  return {
    ref: setNodeRef,
    style: enabled ? { transform: CSS.Translate.toString(transform), transition } : undefined,
    handleProps: enabled ? { ...safeAttributes, ...guardedListeners } : {},
    isDragging,
  };
}
