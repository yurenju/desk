import { createContext, useContext } from "react";

const DragEnabledContext = createContext(false);

export const DragEnabledProvider = DragEnabledContext.Provider;

export function useDragEnabled(): boolean {
  return useContext(DragEnabledContext);
}

/**
 * Which week-cell half the pointer is currently over during a drag, so the cell
 * can highlight "top3" vs "other" live (a week cell is one droppable split by
 * vertical position, so dnd-kit's per-zone `isOver` can't provide this).
 */
export interface WeekDropHint {
  date: string;
  zone: "top3" | "other";
}

const WeekDropHintContext = createContext<WeekDropHint | null>(null);

export const WeekDropHintProvider = WeekDropHintContext.Provider;

export function useWeekDropHint(): WeekDropHint | null {
  return useContext(WeekDropHintContext);
}
