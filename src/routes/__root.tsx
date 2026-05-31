import { useEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TopNav } from "@/features/shell/TopNav";
import { useAuthStore } from "@/store/auth";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    useAuthStore.getState().fetchMe();
  }, []);

  return (
    <>
      <TopNav />
      <Outlet />
    </>
  );
}
