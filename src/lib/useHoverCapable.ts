import { useEffect, useState } from "react";

/**
 * True on pointer/hover-capable devices ((hover: hover)). Returns false when
 * matchMedia is unavailable (jsdom/tests) so the no-drag path renders there.
 */
export function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover)");
    setCapable(mq.matches);
    const onChange = () => setCapable(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return capable;
}
