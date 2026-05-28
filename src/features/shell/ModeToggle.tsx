import { useLocation, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/ui/SegmentedControl";
import styles from "./ModeToggle.module.css";

type Mode = "plan" | "today";

// Show ⌘ on Apple platforms, ⌃ (Ctrl) elsewhere. Falls back to ⌘ on SSR.
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const modKey = isMac ? "⌘" : "⌃";

function ModeLabel({ text, shortcut }: { text: string; shortcut: string }) {
  return (
    <>
      <span>{text}</span>
      <span className={styles.shortcut}>
        {modKey}
        {shortcut}
      </span>
    </>
  );
}

export function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const current: Mode = location.pathname.startsWith("/plan") ? "plan" : "today";

  return (
    <SegmentedControl<Mode>
      value={current}
      onValueChange={(v) => navigate({ to: v === "plan" ? "/plan" : "/today" })}
      ariaLabel="Mode"
      options={[
        { value: "plan", label: <ModeLabel text="規劃" shortcut="P" /> },
        { value: "today", label: <ModeLabel text="今天" shortcut="T" /> },
      ]}
    />
  );
}
