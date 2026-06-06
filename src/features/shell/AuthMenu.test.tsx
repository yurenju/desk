import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth";
import { AuthMenu } from "./AuthMenu";

// Render AuthMenu inside a minimal TanStack Router context so the `<Link
// to="/login">` it renders can resolve to a real `<a href="/login">`. The
// router only needs a root route (hosting AuthMenu) and a `/login` route stub.
function renderWithRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AuthMenu />
        <Outlet />
      </>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, loginRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  useAuthStore.setState({ me: null, status: "loading" });
  vi.restoreAllMocks();
});

describe("AuthMenu", () => {
  it("shows nothing while loading", () => {
    useAuthStore.setState({ me: null, status: "loading" });
    const { container } = renderWithRouter();
    expect(container.textContent).toBe("");
  });

  it("shows login link when unauthenticated", async () => {
    useAuthStore.setState({ me: null, status: "unauthenticated" });
    renderWithRouter();
    expect(
      await screen.findByRole("link", { name: /登入 WSPC/ }),
    ).toHaveAttribute("href", "/login");
  });

  it("keeps theme inside a settings menu when unauthenticated (no standalone segmented)", async () => {
    useAuthStore.setState({ me: null, status: "unauthenticated" });
    renderWithRouter();
    // theme is not directly visible — it lives inside the ⋯ menu
    expect(screen.queryByRole("group", { name: "Theme" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /更多設定/ }));
    expect(await screen.findByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("shows display name; logout + theme live inside the dropdown", async () => {
    useAuthStore.setState({
      me: { userId: "u-1", email: "a@b", displayName: "Alice" },
      status: "authenticated",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    renderWithRouter();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Alice|帳號選單/ }),
    );
    expect(await screen.findByText("a@b")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    const logout = screen.getByRole("menuitem", { name: /登出/ });
    await userEvent.click(logout);
    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("clears local auth state even if the logout request fails", async () => {
    useAuthStore.setState({
      me: { userId: "u-1", email: "a@b", displayName: "Alice" },
      status: "authenticated",
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    renderWithRouter();
    await userEvent.click(
      await screen.findByRole("button", { name: /Alice|帳號選單/ }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /登出/ }));

    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("falls back to email on the trigger when displayName is missing", async () => {
    useAuthStore.setState({
      me: { userId: "u-1", email: "a@b" },
      status: "authenticated",
    });
    renderWithRouter();
    const trigger = await screen.findByRole("button", { name: /帳號選單/ });
    expect(trigger).toHaveTextContent("a@b");
  });
});
