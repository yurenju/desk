import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("defaults to 'auto' preference", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.pref).toBe("auto");
  });

  it("loads saved pref from localStorage", () => {
    localStorage.setItem("desk.theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.pref).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  it("setPref persists to localStorage and updates data-theme", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setPref("light");
    });
    expect(localStorage.getItem("desk.theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("auto resolves to dark when prefers-color-scheme is dark", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe("dark");
  });
});
