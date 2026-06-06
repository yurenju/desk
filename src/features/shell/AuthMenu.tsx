import { Link } from "@tanstack/react-router";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useAuthStore } from "@/store/auth";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./AuthMenu.module.css";

export function AuthMenu() {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <Link to="/login" className={styles.loginBtn}>
        登入 WSPC
      </Link>
    );
  }

  const label = me?.displayName ?? me?.email ?? "";
  const initial = label.slice(0, 1).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
  }

  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={styles.trigger} aria-label="帳號選單">
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.name}>{label}</span>
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          align="end"
          sideOffset={6}
          className={styles.positioner}
        >
          <BaseMenu.Popup className={styles.popup}>
            {me?.email && <div className={styles.email}>{me.email}</div>}
            <div
              className={styles.themeRow}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={styles.sectionLabel}>主題</span>
              <ThemeToggle />
            </div>
            <BaseMenu.Item className={styles.logout} onClick={logout}>
              登出
            </BaseMenu.Item>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
