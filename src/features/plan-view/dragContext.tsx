import { createContext, useContext } from "react";

const DragEnabledContext = createContext(false);

export const DragEnabledProvider = DragEnabledContext.Provider;

export function useDragEnabled(): boolean {
  return useContext(DragEnabledContext);
}
