// Context file intentionally mixes component and non-component exports
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";

// Re-export arrayMove so Task 8 (PlanLayout) can import it from here
export { arrayMove };

export interface DragOrdering {
  activeId: string | null;
  previewOrder: (containerId: string, baseIds: string[]) => string[];
}

const Ctx = createContext<DragOrdering>({ activeId: null, previewOrder: (_c, ids) => ids });
export function useDragOrdering() {
  return useContext(Ctx);
}

export function DragOrderingProvider({
  value,
  children,
}: {
  value: DragOrdering;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
