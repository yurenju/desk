import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth";

export function AuthMenu() {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return <Link to="/login">登入 WSPC</Link>;
  }

  const label = me?.displayName ?? me?.email ?? "";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
  }

  return (
    <>
      <span>{label}</span>
      <button type="button" onClick={logout}>
        登出
      </button>
    </>
  );
}
