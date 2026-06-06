import { Link } from "@tanstack/react-router";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useAuthStore } from "@/store/auth";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./AuthMenu.module.css";

// Theme picker row shared by the signed-out (⋯) menu and the signed-in
// (avatar) menu. stopPropagation keeps the menu open while toggling theme.
function ThemeMenuRow() {
  return (
    <div className={styles.themeRow} onClick={(e) => e.stopPropagation()}>
      <span className={styles.sectionLabel}>主題</span>
      <ThemeToggle />
    </div>
  );
}

export function AuthMenu() {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  if (status === "loading") return null;

  // Signed out: primary login action + a ⋯ menu holding theme. Mirrors the
  // signed-in shape (a primary element + an expandable menu) so the top-right
  // is structurally consistent regardless of auth state.
  if (status === "unauthenticated") {
    return (
      <>
        <Link to="/login" className={styles.loginBtn}>
          登入 WSPC
        </Link>
        <BaseMenu.Root>
          <BaseMenu.Trigger className={styles.iconTrigger} aria-label="更多設定">
            <span aria-hidden="true">⋯</span>
          </BaseMenu.Trigger>
          <BaseMenu.Portal>
            <BaseMenu.Positioner align="end" sideOffset={6} className={styles.positioner}>
              <BaseMenu.Popup className={styles.popup}>
                <ThemeMenuRow />
              </BaseMenu.Popup>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.Root>
      </>
    );
  }

  const label = me?.displayName ?? me?.email ?? "";
  const initial = label.slice(0, 1).toUpperCase();

  async function logout() {
    // Always clear local auth state, even if the network request fails —
    // otherwise a failed POST leaves the user looking signed-in. The backend
    // session may linger, but the UI returns to the unauthenticated state.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Network failure — fall through and clear local state anyway.
    } finally {
      clear();
    }
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
        <BaseMenu.Positioner align="end" sideOffset={6} className={styles.positioner}>
          <BaseMenu.Popup className={styles.popup}>
            {me?.email && <div className={styles.email}>{me.email}</div>}
            <ThemeMenuRow />
            <BaseMenu.Item className={styles.logout} onClick={logout}>
              登出
            </BaseMenu.Item>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
