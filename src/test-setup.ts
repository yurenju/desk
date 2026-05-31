import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Bridge vitest fake timers to @testing-library/react's `waitFor`/`findBy*`.
// RTL detects fake timers by looking for a global `jest` object and then calls
// `jest.advanceTimersByTime` while polling. Vitest exposes the same API on `vi`
// but does not define `jest`, so without this shim `waitFor` keeps using real
// timers while the clock is frozen and hangs until the test times out.
const globalWithJest = globalThis as typeof globalThis & {
  jest?: { advanceTimersByTime: (ms: number) => void };
};
if (typeof globalWithJest.jest === "undefined") {
  globalWithJest.jest = {
    advanceTimersByTime: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
  };
}

// jsdom does not implement matchMedia; stub it so vi.spyOn works.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
