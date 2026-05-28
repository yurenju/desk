import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TopNav } from "@/features/shell/TopNav";

export const Route = createRootRoute({
  component: () => (
    <>
      <TopNav />
      <Outlet />
    </>
  ),
});
