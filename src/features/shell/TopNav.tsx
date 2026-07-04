import { DeskLogo } from "@/ui/DeskLogo";
import { AuthMenu } from "./AuthMenu";
import { ModeToggle } from "./ModeToggle";
import { SyncBadge } from "./SyncBadge";
import styles from "./TopNav.module.css";

export function TopNav() {
  return (
    <header className={styles.root}>
      <div className={styles.brand}>
        <DeskLogo />
        <span className={styles.subdomain}>desk.yurenju.me</span>
      </div>
      <div className={styles.mode}>
        <ModeToggle />
      </div>
      <div className={styles.actions}>
        <SyncBadge />
        <AuthMenu />
      </div>
    </header>
  );
}
