import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/store/auth";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();
  const fetchMe = useAuthStore((s) => s.fetchMe);

  return (
    <LoginPage
      onAuthenticated={async () => {
        await fetchMe();
        navigate({ to: "/today" });
      }}
    />
  );
}
